#!/usr/bin/env python3
"""Hook sheets for reading on-screen text (JD cd-hook-sheets method, Herology version).

Reads discovery/data/hook_jobs.json [{id, brand, proven, cands: [video urls in try order], poster}].
Ads already in discovery/data/hooks.json are skipped. PART/PARTS split the list (round robin).
LIMIT (optional) keeps only the first N jobs (the list is sorted Herology first, then by Proven).
Per video: frames at 0.0, 0.5, 1.0, 1.5, 2.0, 3.0s (hook window) + 50% and 85% of duration,
400px wide, 4 per row, one ad per sheet; caption = ad id + timestamp only (no headline or copy).
Identical media (same sha1) are shown once; the index lists every id sharing it.
Output: out/hk_NNNN.jpg + out/index_p<PART>.json
  {"sheets": {name: {"rep": id, "ids": [...], "frames": [labels], "kind": "video"|"poster"}}, "failed": {id: reason}}
"""
import concurrent.futures as cf, hashlib, io, json, os, subprocess, sys, tempfile, time
import requests
from PIL import Image, ImageDraw, ImageFont

PART, PARTS = int(os.environ.get("PART") or 1), int(os.environ.get("PARTS") or 1)
LIMIT = int(os.environ.get("LIMIT") or 0)
FW, COLS, CAP = 400, 4, 34
HOOK_TS = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0]
jobs = json.load(open("discovery/data/hook_jobs.json"))
read = json.load(open("discovery/data/hooks.json")) if os.path.exists("discovery/data/hooks.json") else {}
jobs = [j for j in jobs if j["id"] not in read]
if LIMIT:
    jobs = jobs[:LIMIT]
jobs = jobs[PART - 1::PARTS]
os.makedirs("out", exist_ok=True)
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)


def get(u):
    last = None
    for t in range(3):
        try:
            r = requests.get(u, timeout=90)
            if r.status_code == 200:
                return r.content
            last = f"HTTP {r.status_code}"
            if r.status_code in (403, 404):
                break
        except Exception as e:
            last = type(e).__name__
        time.sleep(2 * (t + 1))
    raise RuntimeError(last)


def fit(im):
    im = im.convert("RGB")
    w, h = im.size
    nh = int(h * FW / w)
    im = im.resize((FW, nh), Image.LANCZOS)
    return im.crop((0, 0, FW, min(nh, 720)))


def frames_of(data):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "v")
        open(p, "wb").write(data)
        try:
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                       capture_output=True, text=True, timeout=60).stdout.strip() or 0)
        except Exception:
            dur = 0
        ts = [t for t in HOOK_TS if dur == 0 or t < dur - 0.05] + ([round(dur * .5, 1), round(dur * .85, 1)] if dur > 4 else [])
        out = []
        for k, t in enumerate(ts):
            o = os.path.join(d, f"f{k}.jpg")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-ss", f"{t:.2f}", "-frames:v", "1", "-q:v", "2", o], timeout=180)
            if os.path.exists(o):
                out.append((f"{t:.1f}s", fit(Image.open(o))))
        return out


def build(j):
    for u in j.get("cands") or []:
        try:
            data = get(u)
            fr = frames_of(data)
            if fr:
                return {"kind": "video", "frames": fr, "sha": hashlib.sha1(data).hexdigest()}
        except Exception as e:
            last = str(e)
    if j.get("poster"):
        try:
            data = get(j["poster"])
            return {"kind": "poster", "frames": [("poster", fit(Image.open(io.BytesIO(data))))], "sha": "p" + hashlib.sha1(data).hexdigest()}
        except Exception as e:
            return {"error": str(e)[:120]}
    return {"error": "no media"}


def sheet(aid, frames, path):
    rows = [frames[i:i + COLS] for i in range(0, len(frames), COLS)]
    rh = [max(f.size[1] for _, f in r) + CAP for r in rows]
    W = COLS * FW + (COLS + 1) * 6
    b = Image.new("RGB", (W, sum(rh) + 6 * (len(rows) + 1)), (18, 18, 18))
    d = ImageDraw.Draw(b)
    y = 6
    for r, h in zip(rows, rh):
        x = 6
        for lab, f in r:
            d.text((x + 4, y + 6), f"{aid[-10:]}  {lab}", font=FONT, fill=(255, 230, 0))
            b.paste(f, (x, y + CAP))
            x += FW + 6
        y += h + 6
    b.save(path, "JPEG", quality=80)


with cf.ThreadPoolExecutor(6) as ex:
    built = list(ex.map(build, jobs))
groups, order, failed = {}, [], {}
for j, b in zip(jobs, built):
    if "error" in b:
        failed[j["id"]] = b["error"]
        continue
    g = groups.get(b["sha"])
    if g:
        g["ids"].append(j["id"])
        continue
    groups[b["sha"]] = {"rep": j["id"], "ids": [j["id"]], "kind": b["kind"], "frames": b["frames"]}
    order.append(b["sha"])
idx = {"sheets": {}, "failed": failed}
for n, s in enumerate(order, 1):
    g = groups[s]
    name = f"hk_p{PART}_{n:04d}.jpg"
    sheet(g["rep"], g["frames"], os.path.join("out", name))
    idx["sheets"][name] = {"rep": g["rep"], "ids": g["ids"], "kind": g["kind"], "frames": [l for l, _ in g["frames"]]}
json.dump(idx, open(f"out/index_p{PART}.json", "w"), indent=0)
print(f"part {PART}/{PARTS}: jobs {len(jobs)} sheets {len(order)} failed {len(failed)}")
