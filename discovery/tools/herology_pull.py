#!/usr/bin/env python3
"""Herology's own Meta ads for Creative Discovery (the Herology side of the gap page).

Reads the live Creative Hub (index.html in this repo, rebuilt nightly by rcc-data/herology-nightly-builder):
RAW_CARDS (hub sheet rows with Meta daily spend) and BAKED_VIDEO_MAPPING (ad name -> exact R2 file name).
Writes discovery/data/raw/herology_ads.json in the same row shape as motion_ie.json, plus a 12th element
with Herology extras:
  [id, "Herology", status, startMs, endMs, displayFormat, 0, "", "facebook|instagram", "", sources, extra]
  sources = [[primaryText, mediaUrl, type, thumbUrl, headline, aspect, cta, landing]]
  extra   = {"ad_name", "product", "cands": [candidate R2 urls in try order], "spend"}
start/end = first/last day with spend > 0; status active when the last spend day is within 3 days of the
newest day in the hub. Cards with no spend at all are kept (status 'not_run') but not counted as live.

Usage: python3 discovery/tools/herology_pull.py [path/to/index.html]
"""
import json, re, sys, os, datetime
from urllib.parse import quote

R2 = "https://pub-70583d87d1ae49d78024fb434a4421a2.r2.dev/"
EXTS = [".mp4", ".MP4", ".mov", ".MOV", ".m4v", ".webm"]
src = sys.argv[1] if len(sys.argv) > 1 else "index.html"
h = open(src, encoding="utf-8").read()


def grab(name):
    i = h.find(name)
    if i < 0:
        raise SystemExit(f"{name} not found in {src}")
    i = h.find("=", i) + 1
    v, _ = json.JSONDecoder().raw_decode(h[i:].lstrip())
    return v


cards = grab("const RAW_CARDS")
mp = grab("const BAKED_VIDEO_MAPPING")


def cands(card):
    name = card["ad_name"]
    f = mp.get(name)
    out = []
    if f:
        stem, ext = os.path.splitext(f)
        for v in (f, stem + ext.lower(), stem + ext.upper()):
            u = R2 + quote(v, safe="")
            if u not in out:
                out.append(u)
    else:
        img = card.get("ad_type") == "IMG"
        for e in ([".png", ".jpg", ".jpeg", ".PNG", ".JPG"] if img else EXTS):
            out.append(R2 + quote(name + e, safe=""))
    return out


def ms(day):
    return int(datetime.datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)


all_days = sorted({d for c in cards for d, m in (c.get("daily") or {}).items() if (m.get("spend") or 0) > 0})
latest = all_days[-1] if all_days else None
rows = []
for c in cards:
    days = sorted(d for d, m in (c.get("daily") or {}).items() if (m.get("spend") or 0) > 0)
    spend = round(sum((m.get("spend") or 0) for m in (c.get("daily") or {}).values()), 2)
    if days:
        start, end = ms(days[0]), ms(days[-1])
        status = "active" if latest and (datetime.date.fromisoformat(latest) - datetime.date.fromisoformat(days[-1])).days <= 3 else "inactive"
    else:
        ld = (c.get("live_date") or "").strip()
        try:
            start = end = ms(ld[:10])
        except Exception:
            start = end = None
        status = "not_run"
    fmt = "video" if c.get("ad_type") == "VID" else ("carousel" if c.get("ad_type") == "CAR" else "image")
    cs = cands(c)
    dims = (c.get("dimensions") or "").split("/")[0].strip() or None
    rid = "hg_" + re.sub(r"[^a-z0-9]+", "-", c["ad_name"].lower()).strip("-")[:90]
    srcs = [[c.get("primary_text") or "", cs[0] if cs else None, fmt if fmt != "carousel" else "image", None,
             c.get("headline") or "", dims, c.get("cta") or "", c.get("landing_page") or ""]]
    rows.append([rid, "Herology", status, start, end, fmt, 0, "", "facebook|instagram", "", srcs,
                 {"ad_name": c["ad_name"], "product": c.get("product") or "", "cands": cs, "spend": spend,
                  "creative": c.get("creative_preview") or "", "description": c.get("description") or ""}])
os.makedirs("discovery/data/raw", exist_ok=True)
json.dump(rows, open("discovery/data/raw/herology_ads.json", "w"), ensure_ascii=False)
print(f"herology ads: {len(rows)} (with spend {sum(1 for r in rows if r[2] != 'not_run')}, active {sum(1 for r in rows if r[2] == 'active')}), newest spend day {latest}")
