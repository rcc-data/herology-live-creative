"""Copy Creative Discovery media into the herology-creative R2 bucket (run by cd-media-copy.yml).
Reads discovery/data/media_jobs.json, skips keys already in media_done.json, downloads each source
(60s timeout, 3 tries) and uploads with boto3 to the R2 S3 endpoint. Never prints credentials."""
import json, os, sys, time, subprocess
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "boto3", "requests"], check=True)
import boto3, requests
JOBS, DONE = "discovery/data/media_jobs.json", "discovery/data/media_done.json"
jobs = json.load(open(JOBS)) if os.path.exists(JOBS) else []
done = json.load(open(DONE)) if os.path.exists(DONE) else {}
mx = int(os.environ.get("MAX") or 0)
s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
CT = {".mp4": "video/mp4", ".mov": "video/quicktime", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
n = fail = 0
for j in jobs:
    if j["key"] in done: continue
    if mx and n >= mx: break
    for t in range(3):
        try:
            r = requests.get(j["src"], timeout=60); r.raise_for_status()
            ext = os.path.splitext(j["key"])[1].lower()
            s3.put_object(Bucket="herology-creative", Key=j["key"], Body=r.content,
                          ContentType=r.headers.get("content-type") or CT.get(ext, "application/octet-stream"),
                          CacheControl="public, max-age=31536000, immutable")
            done[j["key"]] = len(r.content); n += 1; break
        except Exception as e:
            if t == 2: fail += 1; print("FAIL", j["id"], j["key"], type(e).__name__)
            time.sleep(2)
    if n % 50 == 0: json.dump(done, open(DONE, "w"))
json.dump(done, open(DONE, "w"), indent=0)
print(f"copied {n}, failed {fail}, total done {len(done)} of {len(jobs)}")
