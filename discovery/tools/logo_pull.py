"""Pull a logo for every brand in discovery/data/brands.json into R2 (run by cd-logos.yml).

For each brand site, candidates in order: icons declared in the homepage HTML
(apple-touch-icon, icon with sizes, Shopify/CDN favicons), /apple-touch-icon.png, then
Google's favicon service at 256px. Picks the largest raster that opens and is at least 48px,
pads it to a square, resizes to 128px PNG, uploads to discovery/logos/<slug>.png.
Herology uses discovery/assets/logo.png. SVG icons are rasterised with cairosvg when present.
Writes discovery/data/logos.json: {slug: {"u": public url, "src": source, "px": original size}}.
Never prints credentials.
"""
import io, json, os, re, urllib.parse as up
import boto3, requests
from PIL import Image

R2 = "https://pub-70583d87d1ae49d78024fb434a4421a2.r2.dev/"
OUT = "discovery/data/logos.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
brands = json.load(open("discovery/data/brands.json"))
have = json.load(open(OUT)) if os.path.exists(OUT) else {}
force = os.environ.get("FORCE") == "1"
s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
try:
    import cairosvg
except Exception:
    cairosvg = None


def fetch(u, t=25):
    r = requests.get(u, headers=UA, timeout=t, allow_redirects=True)
    r.raise_for_status()
    return r


def cands(site):
    base = "https://" + site.strip().strip("/") + "/"
    out = []
    try:
        r = fetch(base)
        html, base = r.text, r.url
        for tag in re.findall(r"<link\b[^>]*>", html, re.I):
            rel = (re.search(r'rel=["\']([^"\']+)', tag, re.I) or [None, ""])[1].lower()
            href = (re.search(r'href=["\']([^"\']+)', tag, re.I) or [None, ""])[1]
            if not href or "icon" not in rel:
                continue
            sz = re.search(r'sizes=["\'](\d+)', tag, re.I)
            score = (300 if "apple" in rel else 0) + (int(sz.group(1)) if sz else 32)
            out.append((score, up.urljoin(base, href.replace("&amp;", "&"))))
    except Exception as e:
        print("  home", site, type(e).__name__)
    out.sort(key=lambda x: -x[0])
    host = up.urlparse(base).netloc or site
    return [u for _, u in out] + [f"https://{host}/apple-touch-icon.png",
                                  f"https://www.google.com/s2/favicons?domain={host}&sz=256"]


def to_img(r, u):
    b = r.content
    if (b[:5] == b"<?xml" or b"<svg" in b[:400] or u.split("?")[0].endswith(".svg")):
        if not cairosvg:
            return None
        b = cairosvg.svg2png(bytestring=b, output_width=256, output_height=256)
    try:
        im = Image.open(io.BytesIO(b))
        im.load()
        return im.convert("RGBA")
    except Exception:
        return None


def square128(im):
    w, h = im.size
    s = max(w, h)
    c = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    c.paste(im, ((s - w) // 2, (s - h) // 2))
    c = c.resize((128, 128), Image.LANCZOS)
    b = io.BytesIO()
    c.save(b, "PNG", optimize=True)
    return b.getvalue()


def put(slug, body, src, px):
    key = f"discovery/logos/{slug}.png"
    s3.put_object(Bucket="herology-creative", Key=key, Body=body, ContentType="image/png",
                  CacheControl="public, max-age=86400")
    have[slug] = {"u": R2 + key, "src": src, "px": px}


ok = miss = 0
for b in brands:
    slug, site = b["slug"], (b.get("site") or "")
    if slug in have and not force:
        continue
    if b["brand"] == "Herology" and os.path.exists("discovery/assets/logo.png"):
        im = Image.open("discovery/assets/logo.png").convert("RGBA")
        put(slug, square128(im), "assets/logo.png", im.size[0]); ok += 1
        continue
    if not site:
        print("no site", b["brand"]); miss += 1
        continue
    best = None
    for u in cands(site):
        try:
            im = to_img(fetch(u), u)
        except Exception:
            continue
        if im and min(im.size) >= 48:
            best = (im, u)
            break
        if im and not best:
            best = (im, u)
    if best:
        put(slug, square128(best[0]), best[1], best[0].size[0]); ok += 1
        print("ok", b["brand"], best[0].size[0], best[1][:80])
    else:
        print("MISS", b["brand"], site); miss += 1

json.dump(have, open(OUT, "w"), indent=0, sort_keys=True)
print(f"logos: {ok} new, {miss} missing, {len(have)} total of {len(brands)}")
