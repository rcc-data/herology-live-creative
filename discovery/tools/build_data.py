#!/usr/bin/env python3
"""Herology Creative Discovery: filter, tag and package competitor + Herology ads.

Inputs (all optional except motion_ie.json; every raw file has the same row shape):
  discovery/data/raw/motion_ie.json     Motion Inspo pull (ids are Motion ids)
  discovery/data/raw/adlib_ie.json      Meta Ad Library pull (ids prefixed fb_), merged the same way
  discovery/data/raw/herology_ads.json  Herology's own ads (tools/herology_pull.py), brand "Herology"
  row = [id, brand, status, startMs, endMs, displayFormat, saveCountRecent, visualFormats "a|b",
         platforms "a|b", adLibraryUrl, sources[[adText, mediaUrl, type, thumbnailUrl, title, aspectRatio,
         ctaText, ctaLink]], extra? {}]
  discovery/data/hooks.json        {ad_id: {"h": hook_text, "o": onscreen_text, "k": kind, "f": hook_format}}
  discovery/data/media_done.json   {r2 key: bytes} written by the cd-media-copy workflow
  discovery/data/media_src.json    {ad_id: {"src": url, "w": px, "h": px, "dur": s}} (Herology probes)
  discovery/data/lang_review.json  {ad_id: "en" | "xx"} manual language calls for doubtful ads

Outputs:
  discovery/data/ads.json       compact cards for the page (see FIELDS in the file header)
  discovery/data/brands.json    per-brand stats + 1 to 2 sentence summary grounded in the stats
  discovery/data/media_jobs.json  copy jobs for cd-media-copy.yml
  discovery/data/hook_jobs.json   video ads for cd-hook-sheets.yml (unread ones first by Proven)
  discovery/data/build_log.json   counts per brand (raw / English / kept) and drop reasons

Method follows JD Creative Discovery (claude/creative-discovery-*.md): langdetect seed 0, concept_key,
variant_group chained within 7 days, formats per member, Proven = days live (cap 90) + concept variants +
parallel launches (same concept, start within 3 days); "Proven" badge at 60+ days live.

Usage: python3 discovery/tools/build_data.py [--today YYYY-MM-DD] [--doubtful]
"""
import json, os, re, sys, datetime, unicodedata, collections, hashlib

D = "discovery/data"
R2 = "https://pub-70583d87d1ae49d78024fb434a4421a2.r2.dev/"
args = sys.argv[1:]
TODAY = datetime.date.fromisoformat(args[args.index("--today") + 1]) if "--today" in args else datetime.date(2026, 11, 10)
NOW_MS = int(datetime.datetime(TODAY.year, TODAY.month, TODAY.day, tzinfo=datetime.timezone.utc).timestamp() * 1000)
SHOW_DOUBTFUL = "--doubtful" in args


def jl(p, d=None):
    p = os.path.join(D, p)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d


# ---------------------------------------------------------------- load
# Markets: IE (Ireland), UK, NA (North America), AU (Australia / NZ), HH (Heavy hitters: global brands, kept out of market
# stats by default). motion_wide.json rows carry row[11] = "wide" | "heavy" (tier), not an extra dict.
WIDE_MKT = {"Oriel Magnesium": "IE", "Revive Collagen": "UK", "Gold Collagen": "UK", "Free Soul": "UK", "Spacegoods": "UK",
            "Your Heights": "UK", "Metagenics ANZ": "AU", "The Gut Co": "AU", "Naternal": "AU"}
HEAVY = {"IM8", "Grüns", "Winks Sleep", "AG1", "Cymbiotika", "Seed", "Bloom Nutrition"}
MARKETS = {"IE": "Ireland", "UK": "UK", "NA": "North America", "AU": "Australia", "HH": "Heavy hitters"}
raw = []
for f, mkt in (("raw/motion_ie.json", "IE"), ("raw/adlib_ie.json", "IE"), ("raw/herology_ads.json", "IE"),
               ("raw/motion_uk.json", "UK"), ("raw/motion_na.json", "NA"), ("raw/motion_wide.json", None)):
    rows = jl(f, [])
    for r in rows:
        r = list(r) + [None] * (12 - len(r))
        tier = None
        if f.endswith("motion_wide.json"):
            tier = r[11] if isinstance(r[11], str) else "wide"
            r[11] = None
            if tier == "heavy" or r[1] in HEAVY:
                tier, m = "heavy", "HH"
            else:
                m = WIDE_MKT.get(r[1], "NA")
        else:
            m = mkt
        raw.append((r, m, f.split("/")[-1].split("_")[0] + ("_" + m.lower() if f.endswith("motion_wide.json") else ""), tier))
hooks = jl("hooks.json", {})
done = jl("media_done.json", {})
msrc = jl("media_src.json", {})
lang_review = jl("lang_review.json", {})

URL_RE = re.compile(r"https?://\S+|www\.\S+|@\w+|#\w+")


def strip_text(t):
    t = URL_RE.sub(" ", t or "")
    t = "".join(c if (c.isalpha() or c.isspace() or c in ".,!?'") else " " for c in t)
    return re.sub(r"\s+", " ", t).strip()


def norm(t):
    t = unicodedata.normalize("NFKD", (t or "").lower())
    t = URL_RE.sub(" ", t)
    t = "".join(c for c in t if c.isalnum() or c.isspace())
    return re.sub(r"\s+", " ", t).strip()


# ---------------------------------------------------------------- language
from langdetect import DetectorFactory, detect_langs  # noqa: E402
DetectorFactory.seed = 0


def lang_of(text):
    s = strip_text(text)
    words = len(s.split())
    if words < 4:
        return "en", 1.0, words, "short"
    try:
        ls = detect_langs(s)
    except Exception:
        return "en", 0.0, words, "short"
    best = ls[0]
    en = next((x.prob for x in ls if x.lang == "en"), 0.0)
    if en >= 0.8:
        return "en", en, words, "ok"
    return best.lang, best.prob, words, ("doubt" if en >= 0.2 or words < 10 else "ok")


# ---------------------------------------------------------------- tag dictionaries
def rx(*ws):
    return re.compile(r"(?<![a-z])(?:" + "|".join(ws) + r")", re.I)


BENEFIT = [
    ("hormones/PMS", rx(r"hormon", r"pms\b", r"pmdd", r"period", r"menstrua", r"cycle\b", r"cramp", r"mood swing", r"luteal", r"time of the month", r"of (?:the|your) month", r"monthly")),
    ("menopause", rx(r"menopaus", r"peri-?menopaus", r"\bperi\b", r"post-?menopaus", r"hot flush", r"hot flash", r"night sweat", r"\bmeno\b", r"meno ", r"meno-")),
    ("fertility/pregnancy", rx(r"fertil", r"\bttc\b", r"trying to conceive", r"conceiv", r"pregnan", r"prenatal", r"pre-natal", r"\bivf\b", r"egg quality", r"sperm", r"bump\b", r"trimester")),
    ("postnatal", rx(r"postnatal", r"post-natal", r"postpartum", r"post-partum", r"post partum", r"breastfe", r"new mum", r"new mom", r"after baby", r"newborn", r"4th trimester", r"fourth trimester")),
    ("sleep/stress", rx(r"sleep", r"insomnia", r"stress", r"anxi", r"calm", r"cortisol", r"relax", r"wind down", r"wind-down", r"overwhelm", r"switch off", r"rest\b", r"burnt? ?out", r"burnout")),
    ("skin/hair", rx(r"skin", r"hair", r"nails", r"collagen", r"glow", r"wrinkle", r"ageing", r"aging", r"complexion", r"fine lines", r"elasticity")),
    ("PCOS", rx(r"pcos", r"polycystic", r"inositol", r"insulin resist")),
    ("energy", rx(r"energy", r"energi", r"fatigue", r"tired", r"exhaust", r"brain fog", r"sluggish", r"get up and go", r"stamina", r"vitality")),
    ("performance", rx(r"creatine", r"\bgym", r"workout", r"performance", r"training", r"lifting", r"muscle strength", r"build muscle", r"lean muscle", r"exercise")),
    ("gut", rx(r"\bgut\b", r"bloat", r"digest", r"probiotic", r"prebiotic", r"constipat", r"bowel")),
]
INGREDIENT = [
    ("magnesium", rx(r"magnesium")), ("inositol", rx(r"inositol")), ("creatine", rx(r"creatine")),
    ("collagen", rx(r"collagen")), ("ashwagandha", rx(r"ashwagandha", r"ksm-66")), ("saffron", rx(r"saffron")),
    ("vitamin D", rx(r"vitamin d\b", r"vit d\b", r"d3\b")), ("B vitamins", rx(r"b vitamins?", r"b6\b", r"b12\b", r"vitamin b", r"b-complex", r"b complex")),
    ("folate", rx(r"folate", r"folic", r"methylfolate")), ("iron", rx(r"\biron\b")), ("omega-3", rx(r"omega", r"fish oil", r"\bdha\b", r"krill")),
    ("probiotics", rx(r"probiotic", r"prebiotic", r"bacteria", r"cultures")), ("adaptogens", rx(r"adaptogen", r"rhodiola", r"maca")),
    ("mushrooms", rx(r"mushroom", r"shroom", r"lion'?s mane", r"reishi", r"cordyceps", r"chaga")),
    ("vitex/chasteberry", rx(r"vitex", r"chaste ?berry", r"agnus castus")), ("DIM", rx(r"\bdim\b", r"diindolylmethane")),
    ("L-theanine", rx(r"theanine")), ("CoQ10", rx(r"coq10", r"coenzyme")), ("zinc", rx(r"\bzinc\b")), ("choline", rx(r"choline")),
    ("iodine", rx(r"iodine")), ("biotin", rx(r"biotin")), ("hyaluronic acid", rx(r"hyaluronic")), ("protein", rx(r"protein")),
    ("fibre", rx(r"fibre", r"fiber")), ("vitamin C", rx(r"vitamin c\b")), ("selenium", rx(r"selenium")),
]
PROOF = [
    ("reviews", rx(r"review", r"5[- ]star", r"five star", r"★", r"⭐️?⭐", r"trustpilot", r"real customer", r"rated", r"customers? (?:say|love)")),
    ("founder", rx(r"founder", r"co-founder", r"cofounder", r"i created", r"our story", r"why we (?:made|started|created)")),
    ("expert/GP", rx(r"doctor", r"\bgp\b", r"\bdr\.? [a-z]", r"pharmacist", r"nutritionist", r"dietitian", r"dietician", r"expert", r"gynae", r"gynecolog", r"midwife", r"scientist", r"formulated (?:by|with) ", r"obstetric", r"naturopath", r"\bmd\b", r"practitioner")),
    ("study", rx(r"stud(?:y|ies)", r"clinical", r"research", r"scientifically", r"trial", r"proven", r"evidence", r"\d+% (?:of|saw|felt|reported|less|more|reduction|improve)")),
    ("before-after", rx(r"before (?:and|&|vs\.?|/) ?after", r"before/after", r"transformation", r"day 1 vs", r"week 1 vs", r"results after")),
    ("UGC testimonial", rx(r"since (?:taking|starting|using)", r"i(?:'ve| have) been taking", r"i tried", r"changed my life", r"game ?changer", r"my experience", r"honest review", r"i was (?:skeptical|sceptical)", r"testimonial")),
    ("press", rx(r"as seen (?:in|on)", r"featured in", r"sunday times", r"irish times", r"irish independent", r"vogue", r"\bimage magazine", r"award", r"winner", r"rte\b", r"the times", r"daily mail", r"telegraph", r"guardian", r"tatler", r"harper")),
]
OFFER = [
    ("subscription", rx(r"subscri", r"auto-?ship", r"auto-?deliver", r"monthly plan", r"cancel any ?time", r"vip club")),
    ("bundle", rx(r"bundle", r"\bkit\b", r"\bduo\b", r"\btrio\b", r"buy \d", r"buy one", r"bogo", r"3 for", r"2 for", r"stack\b", r"multi-?pack")),
    ("% off", rx(r"\d+ ?% off", r"up to \d+ ?%", r"save \d+ ?%", r"save up to", r"save \d", r"\bsale\b", r"discount", r"black friday", r"cyber monday", r"\bcode\b", r"€\d+ off", r"£\d+ off", r"half price", r"lowest price")),
    ("gift", rx(r"free gift", r"gift with", r"\bgwp\b", r"free .{0,20}(?:gift|bag|shaker|sample|tote|bottle)", r"gift set", r"stocking filler", r"christmas gift")),
    ("free shipping", rx(r"free (?:shipping|delivery|postage)", r"ships free", r"free next day")),
]
HOOK_FORMATS = ["Question", "Symptom callout", "POV / Relatable", "Bold claim", "Expert intro", "Testimonial quote", "Personal story",
                "Social proof / Numbers", "Offer / Price first", "Product reveal", "List / Tips", "Myth buster / Mistake",
                "Results / Before and after", "Founder story", "Urgency", "Ingredient focus", "Visual only", "Other"]
MATCH_ORDER = ["Balance", "PPN", "Meno", "Zen", "Collagen", "Inositol", "Creatine", "Men's Prenatal"]
MATCH_KW = {
    "Meno": rx(r"menopaus", r"peri-?menopaus", r"\bperi\b", r"post-?menopaus", r"hot flush", r"hot flash", r"night sweat", r"\bmeno"),
    "PPN": rx(r"prenatal", r"pre-natal", r"postnatal", r"post-natal", r"postpartum", r"post-partum", r"pregnan", r"trying to conceive", r"\bttc\b", r"breastfe", r"fertil", r"conceiv"),
    "Inositol": rx(r"pcos", r"polycystic", r"inositol", r"insulin resist"),
    "Zen": rx(r"magnesium", r"sleep", r"calm", r"stress", r"anxi", r"cortisol", r"relax", r"theanine", r"wind down"),
    "Collagen": rx(r"collagen", r"skin", r"wrinkle", r"glow", r"fine lines", r"nails"),
    "Creatine": rx(r"creatine"),
    "Men's Prenatal": rx(r"sperm", r"male fertil", r"men'?s fertil", r"dads?-to-be", r"men'?s prenatal"),
    "Balance": rx(r"hormon", r"pms\b", r"pmdd", r"period", r"mood", r"energy", r"fatigue", r"tired", r"brain fog", r"cycle\b", r"cramp"),
}
# Scope (Ryan's rules): drop kids, weight-loss / GLP-1, men-only (unless men's fertility), hair-only gummies,
# gut-only, joint, heart, tan, libido, intimate, electrolytes, omega, shilajit, iron, focus-only.
DROP_SLUG = [
    ("kids", r"kids|junior|teen|children|family-calm|kids-"),
    ("weight-loss", r"slim|weight-loss|lose-weight|belly|puffy|smooth-body|tone-sculpt|cellulite|glp|fat-burn|ultimate-slim"),
    ("men-only", r"andropause|male-andropause|mens-digestive|for-men|gut-power-for-men|bloating-relief-for-men|shilajit"),
    ("gut-only", r"de-blo|bloat|digestive|gut-|belly-reset|complete-gut"),
    ("not in range", r"joint|cholesterol|heart|tan-glow|turn-me-on|her-v-confidence|womens-bio-balance|electrolyte|omega|iron-gummies|biotin|lion-mane|focus-concentration|kids-focus|calcium"),
]
KEEP_SLUG = [  # slug pattern -> Herology match
    (r"complete-women|womens-multivitamin|womens-health|saffron", "Balance"),
    (r"fertility", "PPN"), (r"her-moisture|meno|menopause", "Meno"),
    (r"magnesium|sleep|calm|theanine|relax|cortisol", "Zen"),
    (r"collagen|skin-glow|facial-glow", "Collagen"), (r"creatine", "Creatine"),
    (r"hormone|feel-balanced|yourself-again|what-is-happening|feel-like-yourself|happy-days|the-elevator|the-booster|same-woman", "Balance"),
    (r"revive-active|zest-active", "Balance"),
]
WEIGHT = rx(r"weight", r"slim", r"belly", r"fat\b", r"flat stomach", r"jeans", r"cellulite", r"glp", r"ozempic", r"mounjaro",
            r"appetite", r"metabolism", r"puffy", r"\blbs\b", r"pounds", r"dress size", r"waist", r"bloat", r"thighs", r"craving")
KIDS = rx(r"for (?:your |the )?kids", r"kids'? ?(?:gummies|vitamins|magnesium|sleep|focus|multi|range|bundle)", r"children'?s (?:vitamin|gummies|supplement)", r"for (?:your )?child", r"toddler", r"junior", r"teen\b")
MENONLY = rx(r"andropause", r"for men\b", r"men'?s health", r"testosterone")


# advertorial / listicle landers (no advertorials, as in the Ireland build)
ADVERTORIAL = re.compile(r"advertorial|listicle|/articles?/|/blogs?/|\d+-reasons|reasons-why|-reasons\b|thequalityedit|/apps/jurni/", re.I)


def slug_of(link):
    s = re.sub(r"^https?://", "", (link or "").lower()).split("?")[0].rstrip("/")
    parts = s.split("/")
    return parts[-1] if len(parts) > 1 else ""


def classify_scope(brand, text, links, extra):
    """Return (keep, reason, herology_match_from_slug)."""
    if brand == "Herology":
        p = (extra or {}).get("product") or ""
        m = {"Brand (Overall)": None, "Quiz": None}.get(p, p) or None
        return True, "herology", m
    slugs = [slug_of(l) for l in links if l]
    if any(ADVERTORIAL.search(l or "") for l in links):
        return False, "advertorial", None
    for reason, pat in DROP_SLUG:
        if any(re.search(pat, s) for s in slugs):
            # andropause etc. never kept; the rest kept only if the slug ALSO matches a keep pattern
            if not any(re.search(kp, s) for s in slugs for kp, _ in KEEP_SLUG) or reason in ("kids", "weight-loss", "men-only"):
                return False, reason, None
    match = None
    for s in slugs:
        for kp, m in KEEP_SLUG:
            if re.search(kp, s):
                match = m
                break
        if match:
            break
    tl = text.lower()
    w = len(WEIGHT.findall(tl))
    hormone = len(MATCH_KW["Balance"].findall(tl)) + len(MATCH_KW["Meno"].findall(tl)) + len(MATCH_KW["Zen"].findall(tl))
    if w >= 2 and w >= hormone:
        return False, "weight-loss", None
    if KIDS.search(tl) and not match:
        return False, "kids", None
    if MENONLY.search(tl) and not re.search(r"sperm|fertil", tl):
        return False, "men-only", None
    if match:
        return True, "slug", match
    # generic lander (home, collections, sale pages): keep only if the text matches a Herology product
    for m in MATCH_ORDER:
        if MATCH_KW[m].search(tl):
            return True, "text", None
    return False, "no overlap", None


def tags_of(pat_list, text):
    return [k for k, p in pat_list if p.search(text)]


def herology_match(text, slug_match, benefits):
    tl = text.lower()
    if slug_match:
        # a hormone page whose text is about menopause is Meno, not Balance
        if slug_match == "Balance" and len(MATCH_KW["Meno"].findall(tl)) >= 2:
            return "Meno"
        return slug_match
    sc = {m: len(MATCH_KW[m].findall(tl)) for m in MATCH_ORDER}
    best = max(MATCH_ORDER, key=lambda m: (sc[m], -MATCH_ORDER.index(m)))
    return best if sc[best] else "none"


# ---------------------------------------------------------------- aspect
def aspect_bucket(a, w=None, h=None):
    if w and h:
        r = w / h
    else:
        m = re.match(r"\s*(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)", str(a or ""))
        if not m:
            return None
        r = float(m.group(1)) / float(m.group(2))
    best = min([("9:16", 9 / 16), ("4:5", 0.8), ("1:1", 1.0), ("16:9", 16 / 9), ("2:3", 2 / 3)], key=lambda x: abs(x[1] - r))
    return best[0] if best[0] != "2:3" else "4:5"


def brand_slug(b):
    return re.sub(r"[^a-z0-9]+", "-", b.lower()).strip("-")


def ext_of(u, dflt):
    e = os.path.splitext((u or "").split("?")[0])[1].lower()
    return e if e in (".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".gif") else dflt


# ---------------------------------------------------------------- pass 1: per ad
log = collections.defaultdict(lambda: collections.Counter())
drops = collections.defaultdict(lambda: collections.Counter())
ads = []
doubt = []
for r, mkt, origin, tier in raw:
    (aid, brand, status, s_ms, e_ms, dfmt, saves, vfs, plats, alib, srcs, extra) = r[:12]
    srcs = srcs or []
    log[brand]["raw"] += 1
    if brand != "Herology":
        pass
    elif status == "not_run":
        drops[brand]["never ran"] += 1
        continue
    s0 = srcs[0] if srcs else [None] * 8
    text = (s0[0] or "")
    title = (s0[4] or "")
    alltext = " ".join(filter(None, [text, title] + [(s[0] or "") + " " + (s[4] or "") for s in srcs[1:3]]))
    lang, conf, nw, flag = lang_of(text + " " + title)
    if aid in lang_review:
        lang = lang_review[aid]
    elif flag == "doubt":
        doubt.append((aid, brand, lang, round(conf, 2), (title + " | " + text)[:200].replace("\n", " ")))
    if lang != "en":
        drops[brand]["not English"] += 1
        continue
    log[brand]["english"] += 1
    links = [s[7] for s in srcs if len(s) > 7 and s[7]]
    blob = alltext + " " + " ".join(links or []) + " " + json.dumps((extra or {}).get("ad_name", ""))
    keep, why, slug_m = classify_scope(brand, alltext + " " + (extra or {}).get("description", ""), links, extra)
    if not keep:
        drops[brand][why] += 1
        continue
    log[brand]["kept"] += 1
    tl = blob
    ben = tags_of(BENEFIT, tl) or ["other"]
    ing = tags_of(INGREDIENT, tl)
    vf = [v for v in (vfs or "").split("|") if v]
    proof = tags_of(PROOF, tl)
    if "Before and After" in vf or "Transformation" in vf:
        proof.append("before-after")
    if any(v.startswith("UGC") or v in ("Yapper", "Testimonial", "Talking Head", "Street Interview") for v in vf) and "UGC testimonial" not in proof:
        proof.append("UGC testimonial")
    if brand == "Herology" and "_UGC_" in (extra or {}).get("ad_name", "") and "UGC testimonial" not in proof:
        proof.append("UGC testimonial")
    if brand == "Herology" and re.search(r"_(?:Michelle|Sarah|RebeccaONeill|SarahMichelle)_|Dr[A-Z]|Pharmacist", (extra or {}).get("ad_name", "")):
        if "expert/GP" not in proof:
            proof.append("expert/GP")
    proof = sorted(set(proof), key=lambda x: [p for p, _ in PROOF].index(x))
    offer = tags_of(OFFER, tl) or ["none"]
    hm = herology_match(alltext, slug_m, ben)
    DEF_BEN = {"Balance": "hormones/PMS", "Zen": "sleep/stress", "Collagen": "skin/hair", "Meno": "menopause", "PPN": "fertility/pregnancy",
               "Inositol": "PCOS", "Creatine": "performance", "Men's Prenatal": "fertility/pregnancy"}
    if ben == ["other"] and any(re.search(r"revive-active|zest-active", l or "") for l in links):
        ben = ["energy"]
    if ben == ["other"] and DEF_BEN.get(slug_m or (hm if brand != "Herology" else (extra or {}).get("product"))):
        ben = [DEF_BEN[slug_m or (hm if brand != "Herology" else (extra or {}).get("product"))]]
    if brand == "Herology" and slug_m:
        hm = slug_m
    if brand == "Herology" and not slug_m:
        hm = "none"
    start = datetime.datetime.fromtimestamp(s_ms / 1000, datetime.timezone.utc).date() if s_ms else None
    live = status == "active"
    end_ms = max(e_ms or 0, NOW_MS) if live else (e_ms or s_ms)
    end = datetime.datetime.fromtimestamp(end_ms / 1000, datetime.timezone.utc).date() if end_ms else None
    days = max(1, (end - start).days + 1) if start and end else 1
    fmt = dfmt if dfmt in ("video", "image", "carousel") else ("video" if any(s[2] == "video" for s in srcs) else "image")
    # media per ad (first source only gets copied; other sources stay on Motion URLs)
    bs = brand_slug(brand)
    vid = next((s[1] for s in srcs if s[2] == "video" and s[1]), None)
    poster = next((s[3] for s in srcs if s[2] == "video" and s[3]), None)
    imgs = [s[1] for s in srcs if s[2] == "image" and s[1]][:3]
    w = h = None
    if brand == "Herology":
        ms_ = msrc.get(aid) or {}
        cand = (extra or {}).get("cands") or []
        src = ms_.get("src") or (cand[0] if cand else None)
        if fmt == "video":
            vid, poster, imgs = src, None, []
        else:
            imgs, vid = ([src] if src else []), None
        w, h = ms_.get("w"), ms_.get("h")
    asp = aspect_bucket(s0[5] if len(s0) > 5 else None, w, h) or ("9:16" if fmt == "video" else ("1:1" if fmt == "carousel" else "4:5"))
    if brand == "Herology" and not (w and h):
        asp = "9:16" if fmt == "video" else "4:5"
    ads.append(dict(id=aid, brand=brand, market=mkt, origin=origin, tier=tier, status="active" if live else "ended", fmt=fmt, aspect=asp,
                    start=start.isoformat() if start else None, end=end.isoformat() if end else None, days=days,
                    saves=saves or 0, vf=vf, plats=[p for p in (plats or "").split("|") if p], alib=alib or "",
                    text=text, title=title, cta=(s0[6] if len(s0) > 6 else "") or "", link=(s0[7] if len(s0) > 7 else "") or "",
                    benefit=ben, ingredient=ing, proof=proof, offer=offer, match=hm, video=vid, poster=poster, imgs=imgs,
                    nsrc=len(srcs), extra=extra or {}, bslug=bs))

# ---------------------------------------------------------------- concept_key, variant_group, Proven
for a in ads:
    a["concept"] = brand_slug(a["brand"]) + ":" + norm(a["text"] or a["title"])[:60]
by_concept = collections.defaultdict(list)
for a in ads:
    by_concept[a["concept"]].append(a)
for a in ads:
    grp = by_concept[a["concept"]]
    variants = len(grp) - 1 if norm(a["text"] or a["title"]) else 0
    par = 0
    if variants and a["start"]:
        sd = datetime.date.fromisoformat(a["start"])
        par = sum(1 for b in grp if b is not a and b["start"] and abs((datetime.date.fromisoformat(b["start"]) - sd).days) <= 3)
    a["proven"] = min(a["days"], 90) + variants + par
    a["is_proven"] = a["days"] >= 60

# ---------------------------------------------------------------- cap per brand (Ryan, 10 Nov: "I dont necessarily need all ads
# from all brands"). Herology keeps all. Other brands keep at most 100 kept ads: up to 34 longest-running, 33 newest, 33 most
# saved (de-duplicated), then filled from the remaining in that order. Heavy tier keeps at most 30. Applied after language + scope.
CAP, CAP_HEAVY = 100, 30
by_brand = collections.defaultdict(list)
for a in ads:
    by_brand[a["brand"]].append(a)
capped = []
for b, lst in by_brand.items():
    lim = None if b == "Herology" else (CAP_HEAVY if any(a["tier"] == "heavy" for a in lst) else CAP)
    log[b]["scoped"] = len(lst)
    if lim is None or len(lst) <= lim:
        capped += lst
        continue
    L_ = sorted(lst, key=lambda a: (-a["days"], a["id"]))
    N_ = sorted(lst, key=lambda a: (a["start"] or "", a["id"]), reverse=True)
    S_ = sorted(lst, key=lambda a: (-(a["saves"] or 0), -a["days"], a["id"]))
    q = round(lim * 34 / 100)
    q2 = (lim - q) // 2
    sel, seen_ = [], set()
    for src_, k in ((L_, q), (N_, q2), (S_, lim - q - q2)):
        for a in src_[:k]:
            if a["id"] not in seen_:
                seen_.add(a["id"]); sel.append(a)
    its = [iter(L_), iter(N_), iter(S_)]
    while len(sel) < lim:
        moved = False
        for it in its:
            for a in it:
                if a["id"] not in seen_:
                    seen_.add(a["id"]); sel.append(a); moved = True
                    break
            if len(sel) >= lim:
                break
        if not moved:
            break
    drops[b]["over cap"] += len(lst) - len(sel)
    capped += sel
for b in by_brand:
    log[b]["kept"] = sum(1 for a in capped if a["brand"] == b)
ads = capped

# copy group (the old variant_group): brand + normalised headline and copy + landing URL without query, chained by start
# dates within 7 days. Card fix (Ryan, 10 Nov: "folding quite a lot of ads into cards. Not all of which match exactly as
# variants"): a card is ONE creative. Within each copy group, members (by start date) go into the first card with the same
# display format, no ad of the same aspect bucket yet, and a start date within 3 days of the card's first ad; otherwise a new
# card. Same rule as JD (jd-ad-briefing-room migrations/20261110_cd_variant_regroup.sql). conceptCount = cards per copy group.
vg_key = collections.defaultdict(list)
for a in ads:
    t = norm(a["title"] + " " + a["text"])
    land = re.sub(r"^https?://(www\.)?", "", (a["link"] or "").split("?")[0].rstrip("/").lower())
    if len(t.split()) < 3:
        vg_key[("solo", a["id"])].append(a)
    else:
        vg_key[(a["brand"], hashlib.md5((t + "|" + land).encode()).hexdigest()[:12])].append(a)
copy_groups = []
for k, grp in vg_key.items():
    grp.sort(key=lambda a: (a["start"] or "", a["id"]))
    chains, cur, last = [], [], None
    for a in grp:
        sd = datetime.date.fromisoformat(a["start"]) if a["start"] else None
        if cur and sd and last and (sd - last).days > 7:
            chains.append(cur)
            cur = []
        cur.append(a)
        last = sd or last
    chains.append(cur)
    copy_groups += chains
cards = []
old_cards = len(copy_groups)
for gi, grp in enumerate(copy_groups):
    gid = f"cg{gi}"
    mine = []
    for a in grp:
        sd = datetime.date.fromisoformat(a["start"]) if a["start"] else None
        for card in mine:
            f0 = card[0]
            s0_ = datetime.date.fromisoformat(f0["start"]) if f0["start"] else None
            if f0["fmt"] == a["fmt"] and all(m["aspect"] != a["aspect"] for m in card) and \
                    ((sd is None and s0_ is None) or (sd and s0_ and abs((sd - s0_).days) <= 3)):
                card.append(a)
                break
        else:
            mine.append([a])
    for card in mine:
        for a in card:
            a["copy_group"] = gid
            a["concept_n"] = len(mine)
    cards += mine


def media_url(a, key, fallback):
    return (R2 + key) if key in done else fallback


jobs = []
hook_jobs = []
for ch in cards:
    for a in ch:
        bs, aid = a["bslug"], a["id"]
        base = f"discovery/{bs}/{aid}/"
        if a["brand"] == "Herology":
            cands = a["extra"].get("cands") or []
            src = (msrc.get(aid) or {}).get("src")
            if src:
                cands = [src]
            jobs.append({"id": aid, "op": "poster" if a["fmt"] == "video" else "thumb", "cands": cands, "key": base + "poster.jpg"})
            a["poster_u"] = media_url(a, base + "poster.jpg", None)
            a["video_u"] = a["video"] if a["fmt"] == "video" else None
            a["imgs_u"] = a["imgs"]
            if a["fmt"] != "video":
                a["poster_u"] = a["poster_u"] or (a["imgs"][0] if a["imgs"] else None)
        else:
            if a["fmt"] == "video":
                if a["video"]:
                    jobs.append({"id": aid, "op": "poster", "cands": [a["video"]], "key": base + "poster.jpg"})
                    jobs.append({"id": aid, "src": a["video"], "key": base + "video" + ext_of(a["video"], ".mp4"), "max_mb": 25})
                elif a["poster"]:
                    jobs.append({"id": aid, "op": "thumb", "cands": [a["poster"]], "key": base + "poster.jpg"})
                a["poster_u"] = media_url(a, base + "poster.jpg", a["poster"])
                a["video_u"] = media_url(a, base + "video" + ext_of(a["video"], ".mp4"), a["video"]) if a["video"] else None
                a["imgs_u"] = []
            else:
                iu = []
                for i, u in enumerate(a["imgs"]):
                    k = base + f"img{i + 1}" + ext_of(u, ".jpg")
                    jobs.append({"id": aid, "src": u, "key": k})
                    iu.append(media_url(a, k, u))
                a["imgs_u"] = iu
                a["video_u"] = None
                a["poster_u"] = iu[0] if iu else None
        if a["fmt"] == "video":
            hook_jobs.append({"id": aid, "brand": a["brand"], "proven": a["proven"],
                              "cands": ([a["video_u"]] if a["video_u"] else []) + (a["extra"].get("cands") or [] if a["brand"] == "Herology" else [a["video"]] if a["video"] and a["video"] != a["video_u"] else []),
                              "poster": a["poster_u"]})

# ---------------------------------------------------------------- hook templates (from read hooks)
TPL_SUBS = [
    (r"\b(herology|happy mammoth|hormone harmony|sisterly|fabu|fabü|novomins|revive active|the elevator|balance|meno|zen|ppn|inositol|collagen|creatine|magnesium)\b", "[PRODUCT]"),
    (r"\b\d{2}\b(?= ?(?:year|yr|y/o|yo)\b)", "[AGE]"), (r"\b(?:in )?my (?:20s|30s|40s|50s|60s)\b", "IN MY [AGE]S"),
    (r"\d+(?:[.,]\d+)?\s?%", "[N]%"), (r"[€£$]\s?\d+(?:[.,]\d+)?", "[PRICE]"), (r"\b\d+(?:[.,]\d+)?\b", "[N]"),
]


def template_of(h):
    if not h:
        return None
    t = h.upper()
    t = re.sub(r"\s+", " ", t).strip()
    tl = t.lower()
    for p, rpl in TPL_SUBS:
        tl = re.sub(p, rpl.lower(), tl, flags=re.I)
    t = tl.upper()
    if "[" not in t:
        return None
    return t[:120]


# ---------------------------------------------------------------- write cards
FIELDS = ["id", "brand", "market", "status", "fmt", "aspect", "start", "end", "days", "proven", "isProven", "saves",
          "vf", "benefit", "ingredient", "proof", "offer", "match", "title", "text", "cta", "link", "alib",
          "poster", "video", "imgs", "hook", "onscreen", "hookKind", "hookFormat", "hookTpl", "formats", "n", "concept", "spend", "adName",
          "conceptCount", "tier"]
out = []
for ch in cards:
    lead = max(ch, key=lambda a: (a["proven"], a["start"] or ""))
    hk = hooks.get(lead["id"]) or {}
    formats = [{"id": a["id"], "aspect": a["aspect"], "fmt": a["fmt"], "video": a.get("video_u"), "img": a.get("poster_u")} for a in ch]
    starts = [a["start"] for a in ch if a["start"]]
    ends = [a["end"] for a in ch if a["end"]]
    status = "active" if any(a["status"] == "active" for a in ch) else "ended"
    st, en = min(starts) if starts else None, max(ends) if ends else None
    days = max(a["days"] for a in ch)
    def U(f):
        return sorted(set(x for a in ch for x in a[f]), key=lambda x: x)
    out.append([lead["id"], lead["brand"], lead["market"], status, lead["fmt"], lead["aspect"], st, en, days,
                max(a["proven"] for a in ch), days >= 60, sum(a["saves"] for a in ch), U("vf"),
                U("benefit"), U("ingredient"), U("proof"), U("offer"), lead["match"],
                lead["title"], lead["text"][:1500], lead["cta"], lead["link"].split("?")[0], lead["alib"],
                lead.get("poster_u"), lead.get("video_u"), lead.get("imgs_u") or [],
                hk.get("h"), hk.get("o"), hk.get("k"), hk.get("f"), template_of(hk.get("h")) if hk.get("k") in ("text", "image_text") else None,
                formats if len(ch) > 1 else [], len(ch), lead["copy_group"], round(sum(a["extra"].get("spend", 0) or 0 for a in ch), 2) or None,
                lead["extra"].get("ad_name"), lead["concept_n"], lead["tier"]])
# ---------------------------------------------------------------- gaps (Herology vs market)
def compute_gaps(out, mkt=None):
    """Herology vs one market (mkt = market code) or vs all markets except Heavy hitters (mkt None)."""
    Fi = {f: i for i, f in enumerate(FIELDS)}
    def vals(c, k):
        v = c[Fi[k]]
        if k == "match":
            return [v or "none"]
        return v if isinstance(v, list) else ([] if v is None else [v])
    hg = [c for c in out if c[1] == "Herology"]
    mk = [c for c in out if c[1] != "Herology" and ((c[Fi["market"]] == mkt) if mkt else c[Fi["market"]] != "HH")]
    if not hg or not mk:
        return []
    t30 = (TODAY - datetime.timedelta(days=30)).isoformat()
    t60 = (TODAY - datetime.timedelta(days=60)).isoformat()
    last = [c for c in mk if (c[Fi["start"]] or "") > t30]
    prior = [c for c in mk if t60 < (c[Fi["start"]] or "") <= t30]
    proven = [c for c in mk if c[Fi["isProven"]]]
    dims = [("Format", "fmt", ["video", "image", "carousel"]), ("Aspect", "aspect", ["9:16", "4:5", "1:1", "16:9"]),
            ("Benefit", "benefit", [b for b, _ in BENEFIT]), ("Proof", "proof", [p for p, _ in PROOF]),
            ("Offer", "offer", [o for o, _ in OFFER]), ("Hook type", "hookFormat", HOOK_FORMATS),
            ("Visual format", "vf", sorted({v for c in mk for v in c[Fi["vf"]]}))]
    res = []
    def sh(cs, k, v):
        return 100.0 * sum(1 for c in cs if v in vals(c, k)) / len(cs) if cs else 0.0
    def one(dim, k, v, H, M, P, L, R, prod=None):
        if k == "hookFormat":
            H = [c for c in H if c[Fi["hookKind"]]]; M = [c for c in M if c[Fi["hookKind"]]]; P = [c for c in P if c[Fi["hookKind"]]]
            L = [c for c in L if c[Fi["hookKind"]]]; R = [c for c in R if c[Fi["hookKind"]]]
            if len(H) < 8 or len(M) < 20:
                return
        if k == "vf" and not H:
            return
        h, m, pv = sh(H, k, v), sh(M, k, v), (sh(P, k, v) if len(P) >= 10 else 0.0)
        if sum(1 for c in M if v in vals(c, k)) < 5:
            return
        l = sum(1 for c in L if v in vals(c, k)); r = sum(1 for c in R if v in vals(c, k))
        rise = (l - r) / max(r, 3)
        top = max(m, pv)
        if k == "vf":
            return  # Herology ads carry no Motion visual-format tags, so this dimension cannot be compared
        if top < 10 and not (l >= 5 and rise > 0.5):
            return
        if h > 0.5 * top:
            return
        score = (top - h) * (1 + max(0.0, min(rise, 2.0)) * 0.5)
        pool = sorted([c for c in M if v in vals(c, k)], key=lambda c: (-c[Fi["isProven"]], -c[Fi["proven"]]))
        ex, used = [], collections.Counter()
        for rnd in range(8):  # round robin by brand so one brand does not fill the examples
            for c in pool:
                if len(ex) >= 8:
                    break
                if c in ex or used[c[1]] > rnd:
                    continue
                ex.append(c); used[c[1]] += 1
        ex = ex[:8]
        brands = collections.Counter(c[1] for c in M if v in vals(c, k)).most_common(3)
        scope = f"{prod} ads" if prod else "ads"
        cap = v[:1].upper() + v[1:]
        title = (f"{prod}: " if prod else "") + {"fmt": f"More {v} ads", "aspect": f"More {v} creative", "benefit": f"Lead with {v}",
                 "proof": f"{cap} as proof", "offer": f"{cap} offers" if v != "none" else "Ads with no offer", "hookFormat": f"{cap} hooks"}.get(k, v)
        why = (f"{round(m)}% of market {scope} ({len(M)} cards)" + (f" and {round(pv)}% of the {len(P)} that ran 60+ days" if len(P) >= 10 else "") + " use it; "
               f"Herology {round(h)}% of {len(H)} cards. Launches: {l} in the last 30 days vs {r} in the 30 before. "
               f"Most used by " + ", ".join(f"{b} ({n})" for b, n in brands) + ".")
        res.append({"title": title, "dim": dim + (f" · {prod}" if prod else ""), "key": k, "value": v, "product": prod,
                    "herology": round(h), "market": round(m), "proven": round(pv), "last30": l, "prior30": r,
                    "score": round(score, 1), "why": why, "examples": [c[0] for c in ex]})
    for dim, k, vs in dims:
        for v in vs:
            if v in ("other", "none") and k in ("benefit",):
                continue
            one(dim, k, v, hg, mk, proven, last, prior)
    for prod in ["Balance", "PPN", "Meno", "Zen"]:
        H = [c for c in hg if c[Fi["match"]] == prod]; M = [c for c in mk if c[Fi["match"]] == prod]
        if len(H) < 5 or len(M) < 15:
            continue
        P = [c for c in M if c[Fi["isProven"]]]
        L = [c for c in M if (c[Fi["start"]] or "") > t30]; R = [c for c in M if t60 < (c[Fi["start"]] or "") <= t30]
        for dim, k, vs in dims[:6]:
            for v in vs:
                if k == "benefit":
                    continue
                one(dim, k, v, H, M, P, L, R, prod)
    res.sort(key=lambda g: -g["score"])
    seen, outg = set(), []
    for g in res:
        key = (g["key"], g["value"])
        if g["product"] and key in seen and len(outg) > 6:
            continue
        seen.add(key)
        outg.append(g)
    return outg[:15]


# hooks on non-lead members (viewer shows the member's own hook)
GAPS = compute_gaps(out)
GAPS_BY = {m: compute_gaps(out, m) for m in MARKETS if any(c[1] != "Herology" and c[2] == m for c in out)}
member_hooks = {a["id"]: hooks[a["id"]] for ch in cards for a in ch if a["id"] in hooks and len(ch) > 1}
out.sort(key=lambda c: (c[6] or ""), reverse=True)
json.dump({"v": 1, "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "today": TODAY.isoformat(),
           "fields": FIELDS, "cards": out, "memberHooks": member_hooks, "gaps": GAPS, "gapsByMarket": GAPS_BY, "markets": MARKETS,
           "pending": ["Gigi Supplements", "Cleanmarine", "Sentro Labs", "Mountaindrop", "Grova", "Byontale"]},
          open(os.path.join(D, "ads.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------------------------------------------------------------- brands.json
SITES = {"Herology": "herologysupplements.com", "Sisterly": "sisterlylab.com", "Revive Active": "reviveactive.com",
         "FabU": "fabuwellness.com", "Novomins Nutrition": "novomins.com", "Happy Mammoth": "happymammoth.com"}
brands = []
F = {f: i for i, f in enumerate(FIELDS)}
for b in sorted(set(c[1] for c in out)):
    cs = [c for c in out if c[1] == b]
    n = len(cs)
    def share(field, val):
        return round(100 * sum(1 for c in cs if (val in c[F[field]] if isinstance(c[F[field]], list) else c[F[field]] == val)) / n) if n else 0
    fm = collections.Counter(c[F["fmt"]] for c in cs)
    ben = collections.Counter(x for c in cs for x in c[F["benefit"]] if x != "other")
    prf = collections.Counter(x for c in cs for x in c[F["proof"]])
    off = collections.Counter(x for c in cs for x in c[F["offer"]] if x != "none")
    mt = collections.Counter(c[F["match"]] for c in cs if c[F["match"]] != "none")
    live = sum(1 for c in cs if c[F["status"]] == "active")
    prov = sum(1 for c in cs if c[F["isProven"]])
    t30 = (TODAY - datetime.timedelta(days=30)).isoformat()
    new30 = sum(1 for c in cs if (c[F["start"]] or "") >= t30)
    med_days = sorted(c[F["days"]] for c in cs)[n // 2] if n else 0
    top_fmt, top_fmt_n = (fm.most_common(1)[0] if fm else ("", 0))
    tb = ben.most_common(2)
    tp = prf.most_common(1)
    to = off.most_common(1)
    s1 = f"{n} cards ({live} live), mostly {top_fmt} ({round(100 * top_fmt_n / n)}%)"
    if tb:
        s1 += ", led by " + " and ".join(f"{k} ({round(100 * v / n)}%)" for k, v in tb)
    s1 += "."
    s2 = f" {prov} have run 60+ days (median {med_days} days live) and {new30} launched in the last 30 days"
    if tp:
        s2 += f"; top proof is {tp[0][0]} ({round(100 * tp[0][1] / n)}%)"
    if to:
        s2 += f", top offer {to[0][0]} ({round(100 * to[0][1] / n)}%)"
    else:
        s2 += ", with no offer in most ads"
    s2 += "."
    if b not in SITES:
        dom = collections.Counter(re.sub(r"^(www|get|try|shop|quiz)\.", "", re.sub(r"^https?://", "", c[F["link"]] or "").split("/")[0].lower()) for c in cs if c[F["link"]])
        SITES[b] = dom.most_common(1)[0][0] if dom else ""
    bm = collections.Counter(c[F["market"]] for c in cs).most_common(1)[0][0]
    brands.append({"brand": b, "slug": brand_slug(b), "site": SITES.get(b, ""), "market": bm, "tier": cs[0][F["tier"]], "cards": n, "ads": sum(c[F["n"]] for c in cs),
                   "live": live, "proven": prov, "new30": new30, "medianDays": med_days,
                   "formats": dict(fm), "benefits": dict(ben.most_common()), "proof": dict(prf.most_common()),
                   "offers": dict(off.most_common()), "match": dict(mt.most_common()),
                   "raw": log[b]["raw"], "english": log[b]["english"], "scoped": log[b]["scoped"], "kept": log[b]["kept"], "drops": dict(drops[b]),
                   "summary": s1 + s2, "pending": False})
for p in ["Gigi Supplements", "Cleanmarine", "Sentro Labs", "Mountaindrop", "Grova", "Byontale"]:
    if p not in [x["brand"] for x in brands]:
        brands.append({"brand": p, "slug": brand_slug(p), "market": "IE", "cards": 0, "pending": True,
                       "summary": "Not in Motion. Coming from Meta Ad Library in a later run."})
json.dump(brands, open(os.path.join(D, "brands.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)

# ---------------------------------------------------------------- jobs + log
seen = set()
jobs_u = []
for j in jobs:
    if j["key"] in seen:
        continue
    seen.add(j["key"])
    jobs_u.append(j)
json.dump(jobs_u, open(os.path.join(D, "media_jobs.json"), "w"), indent=0)
hook_jobs.sort(key=lambda j: (j["brand"] != "Herology", -j["proven"]))
json.dump(hook_jobs, open(os.path.join(D, "hook_jobs.json"), "w"), indent=0)
bl = {b: {"raw": log[b]["raw"], "english": log[b]["english"], "scoped": log[b]["scoped"], "kept": log[b]["kept"], "drops": dict(drops[b]),
          "market": next((a["market"] for a in ads if a["brand"] == b), next((m for r, m, o, t in raw if r[1] == b), None))} for b in log}
multi = [c for c in out if c[F["n"]] > 1]
CARDLOG = {"copy_groups_before": old_cards, "cards_after": len(out), "multi_size_cards": len(multi),
           "repeated_size_cards": sum(1 for c in multi if len({m["aspect"] for m in c[F["formats"]]}) < len(c[F["formats"]])),
           "largest_card": max(c[F["n"]] for c in out), "same_copy_cards": sum(1 for c in out if c[F["conceptCount"]] > 1)}
MKTLOG = {m: {"brands": len({c[1] for c in out if c[2] == m and c[1] != "Herology"}), "ads": sum(c[F["n"]] for c in out if c[2] == m and c[1] != "Herology"),
              "cards": sum(1 for c in out if c[2] == m and c[1] != "Herology")} for m in MARKETS}
json.dump({"brands": bl, "markets": MKTLOG, "card_fix": CARDLOG, "cards": len(out), "ads": len(ads), "media_jobs": len(jobs_u), "video_ads": len(hook_jobs),
           "hooks_read": sum(1 for c in out if c[F["hookKind"]]), "media_done": len(done)},
          open(os.path.join(D, "build_log.json"), "w"), indent=1)
for b, v in bl.items():
    print(f"{str(v['market']):3s} {b:26s} raw {v['raw']:5d}  English {v['english']:5d}  scoped {v['scoped']:5d}  kept {v['kept']:4d}  drops {v['drops']}")
for i, g in enumerate(GAPS[:8], 1):
    print(f"gap {i}: {g['title']} [{g['dim']}] H {g['herology']}% M {g['market']}% P {g['proven']}% score {g['score']}")
print("markets", MKTLOG)
print("card fix", CARDLOG)
print(f"cards {len(out)}  ads {len(ads)}  media jobs {len(jobs_u)}  video ads {len(hook_jobs)}  hooks on cards {sum(1 for c in out if c[F['hookKind']])}  media done {len(done)}")
if SHOW_DOUBTFUL:
    json.dump(doubt, open("/tmp/cd_doubt.json", "w"), ensure_ascii=False, indent=0)
    print(f"doubtful language: {len(doubt)} -> /tmp/cd_doubt.json")
