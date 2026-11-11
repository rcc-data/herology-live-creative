"""Runneth trending pull for Herology (run by cd-trending.yml).

Reads the public, server-rendered Runneth trending pages (runneth.com/trending/<cat>/) for the
supplements and health-wellness lists, records each week's ranked ads, and copies every ad's media
(video, poster, images, brand logo) into the herology-creative R2 bucket under discovery/trending/,
so the ads are stored, not just linked. Writes discovery/data/trending.json:
  {"weeks": {"<Monday>": {"<cat>": [ {rank, brand, age, kind, video, poster, images, logo, src} ]}},
   "cats": {...labels}, "updated": iso}
Re-running in the same week overwrites that week. Never prints credentials.
"""
import datetime as dt, hashlib, json, os, re, time
import boto3, requests
from bs4 import BeautifulSoup

CATS = {"supplements": "Supplements", "health-wellness": "Health & Wellness"}
R2 = "https://pub-70583d87d1ae49d78024fb434a4421a2.r2.dev/"
OUT = "discovery/data/trending.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
CT = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}

today = dt.datetime.now(dt.timezone(dt.timedelta(hours=-7))).date()
week = (today - dt.timedelta(days=today.weekday())).isoformat()
data = json.load(open(OUT)) if os.path.exists(OUT) else {"weeks": {}}
data["cats"] = CATS
stats = {"ads": 0, "copied": 0, "failed": 0}


def copy(url, key_base):
    """Copy one media file to R2; return its public URL, or the source URL if the copy fails."""
    if not url:
        return None
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
    key = f"{key_base}{ext}"
    try:
        s3.head_object(Bucket="herology-creative", Key=key)
        return R2 + key
    except Exception:
        pass
    for t in range(3):
        try:
            r = requests.get(url, headers=UA, timeout=120)
            if r.status_code == 200 and r.content:
                s3.put_object(Bucket="herology-creative", Key=key, Body=r.content, ContentType=CT.get(ext, "application/octet-stream"),
                              CacheControl="public, max-age=31536000, immutable")
                stats["copied"] += 1
                return R2 + key
        except Exception:
            pass
        time.sleep(2 * (t + 1))
    stats["failed"] += 1
    print("  copy failed", url[:90])
    return url


for cat, label in CATS.items():
    url = f"https://runneth.com/trending/{cat}/"
    html = requests.get(url, headers=UA, timeout=60).text
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for i, a in enumerate([x for x in soup.find_all("article") if x.find(["img", "video"])]):
        lines = [x.strip() for x in a.get_text("\n").split("\n") if x.strip() and x.strip() != "·"]
        v = a.find("video")
        vs = v and (v.get("src") or (v.find("source") or {}).get("src"))
        poster = v.get("poster") if v else None
        imgs = [im.get("src") for im in a.find_all("img") if "swipe-file-source" in (im.get("src") or "")]
        logo = next((im.get("src") for im in a.find_all("img") if "brand-page-assets" in (im.get("src") or "")), None)
        src_id = hashlib.md5((vs or (imgs[0] if imgs else "") or str(i)).encode()).hexdigest()[:16]
        base = f"discovery/trending/media/{src_id}"
        row = {"rank": i + 1, "brand": lines[0] if lines else "", "age": next((x for x in lines if re.fullmatch(r"\d+d", x)), ""),
               "kind": "video" if vs else ("carousel" if len(imgs) > 1 else "image"), "src": src_id}
        row["video"] = copy(vs, base) if vs else None
        row["poster"] = copy(poster, base + "_p") if poster else None
        row["images"] = [copy(u, f"{base}_{k}") for k, u in enumerate(imgs[:6])]
        row["logo"] = copy(logo, "discovery/trending/logos/" + hashlib.md5(logo.encode()).hexdigest()[:12]) if logo else None
        rows.append(row)
    if not rows:
        raise SystemExit(f"NO ADS FOUND on {url} (page layout may have changed)")
    data["weeks"].setdefault(week, {})[cat] = rows
    stats["ads"] += len(rows)
    print(f"{cat}: {len(rows)} ads ({sum(r['kind'] == 'video' for r in rows)} video)")

data["updated"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"week {week}: {stats}")
if stats["failed"] > stats["copied"] and stats["failed"] > 5:
    raise SystemExit("Most media copies failed")
