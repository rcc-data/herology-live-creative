"""Copy Creative Discovery media into the herology-creative R2 bucket (run by cd-media-copy.yml).

Reads discovery/data/media_jobs.json, skips keys already in media_done.json. Job kinds:
  {"id", "src", "key", "max_mb"?}          plain copy (images, videos). Videos over max_mb are skipped.
  {"id", "op": "poster", "cands", "key"}    first working candidate video -> ffmpeg frame at 1.0s
                                            (0.3s if that frame is near black), 720px wide JPEG
  {"id", "op": "thumb", "cands", "key"}     first working candidate image -> 720px wide JPEG
poster/thumb jobs also record the working source and its size in media_src.json
({id: {"src", "w", "h", "dur"}}), which build_data.py uses for Herology aspect ratios.
Downloads: 90s timeout, 3 tries, 8 in parallel. Never prints credentials.
Env: MAX (max files this run, 0 = all), VIDEO_GB (stop copying videos after this many GB this run).
"""
import json, os, sys, time, subprocess, tempfile, threading
import concurrent.futures as cf
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "boto3", "requests", "pillow"], check=True)
import boto3, requests
from PIL import Image

JOBS, DONE, SRC = "discovery/data/media_jobs.json", "discovery/data/media_done.json", "discovery/data/media_src.json"
jobs = json.load(open(JOBS)) if os.path.exists(JOBS) else []
done = json.load(open(DONE)) if os.path.exists(DONE) else {}
msrc = json.load(open(SRC)) if os.path.exists(SRC) else {}
mx = int(os.environ.get("MAX") or 0)
vcap = float(os.environ.get("VIDEO_GB") or 6) * 1e9
s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
CT = {".mp4": "video/mp4", ".mov": "video/quicktime", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
lock = threading.Lock()
stats = {"copied": 0, "failed": 0, "skipped_big": 0, "video_bytes": 0}


def get(u):
    last = None
    for t in range(3):
        try:
            r = requests.get(u, timeout=90)
            if r.status_code == 200:
                return r
            last = f"HTTP {r.status_code}"
            if r.status_code in (403, 404):
                break
        except Exception as e:
            last = type(e).__name__
        time.sleep(2 * (t + 1))
    raise RuntimeError(last)


def put(key, body, ctype):
    s3.put_object(Bucket="herology-creative", Key=key, Body=body, ContentType=ctype,
                  CacheControl="public, max-age=31536000, immutable")


def jpeg720(im):
    im = im.convert("RGB")
    w, h = im.size
    if w > 720:
        im = im.resize((720, int(h * 720 / w)), Image.LANCZOS)
    import io
    b = io.BytesIO()
    im.save(b, "JPEG", quality=82)
    return b.getvalue()


def frame_of(data):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "v")
        open(p, "wb").write(data)
        pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                             "stream=width,height:stream_tags=rotate:format=duration", "-of", "json", p],
                            capture_output=True, text=True, timeout=60)
        info = json.loads(pr.stdout or "{}")
        st = (info.get("streams") or [{}])[0]
        w, h = st.get("width"), st.get("height")
        if str((st.get("tags") or {}).get("rotate", "0")) in ("90", "270", "-90"):
            w, h = h, w
        dur = float((info.get("format") or {}).get("duration") or 0)
        best = None
        for t in (1.0, 0.3, 2.0):
            if dur and t >= dur:
                t = max(0, dur / 2)
            o = os.path.join(d, f"f{t}.jpg")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", p, "-frames:v", "1", "-q:v", "2", o], timeout=120)
            if os.path.exists(o):
                im = Image.open(o)
                im.load()
                lum = sum(im.convert("L").resize((16, 16)).getdata()) / 256
                best = im
                if lum > 18:
                    break
        if best is None:
            raise RuntimeError("no frame")
        return jpeg720(best), w, h, round(dur, 2)


def run(j):
    key = j["key"]
    try:
        if j.get("op") in ("poster", "thumb"):
            last = "no candidates"
            for u in j.get("cands") or []:
                try:
                    r = get(u)
                except Exception as e:
                    last = str(e)
                    continue
                if j["op"] == "poster":
                    body, w, h, dur = frame_of(r.content)
                else:
                    import io
                    im = Image.open(io.BytesIO(r.content))
                    w, h, dur = im.size[0], im.size[1], 0
                    body = jpeg720(im)
                put(key, body, "image/jpeg")
                with lock:
                    done[key] = len(body)
                    msrc[j["id"]] = {"src": u, "w": w, "h": h, "dur": dur}
                    stats["copied"] += 1
                return
            raise RuntimeError(last)
        ext = os.path.splitext(key)[1].lower()
        if ext in (".mp4", ".mov"):
            with lock:
                if stats["video_bytes"] > vcap:
                    stats["skipped_big"] += 1
                    return
        r = get(j["src"])
        n = len(r.content)
        if j.get("max_mb") and n > j["max_mb"] * 1e6:
            with lock:
                stats["skipped_big"] += 1
            print("BIG", j["id"], key, round(n / 1e6, 1), "MB", flush=True)
            return
        put(key, r.content, r.headers.get("content-type") or CT.get(ext, "application/octet-stream"))
        with lock:
            done[key] = n
            stats["copied"] += 1
            if ext in (".mp4", ".mov"):
                stats["video_bytes"] += n
    except Exception as e:
        with lock:
            stats["failed"] += 1
        print("FAIL", j["id"], key, str(e)[:120], flush=True)


todo = [j for j in jobs if j["key"] not in done]
if mx:
    todo = todo[:mx]
print(f"jobs {len(jobs)}, already done {len(jobs) - len([j for j in jobs if j['key'] not in done])}, this run {len(todo)}", flush=True)
t0 = time.time()
with cf.ThreadPoolExecutor(8) as ex:
    for c in range(0, len(todo), 64):
        list(ex.map(run, todo[c:c + 64]))
        with lock:
            json.dump(done, open(DONE, "w"))
            json.dump(msrc, open(SRC, "w"))
        if (c // 64) % 3 == 0:
            print(f"{c + 64}/{len(todo)} {stats} {int(time.time() - t0)}s", flush=True)
        if time.time() - t0 > 95 * 60:
            print("time budget reached; stopping (re-dispatch to continue)", flush=True)
            break
json.dump(done, open(DONE, "w"), indent=0)
json.dump(msrc, open(SRC, "w"), indent=0)
print(f"RESULT copied {stats['copied']}, failed {stats['failed']}, skipped_big {stats['skipped_big']}, "
      f"video GB {stats['video_bytes'] / 1e9:.2f}, total done {len(done)} of {len(jobs)}")
