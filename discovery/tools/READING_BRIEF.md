# Hook reading brief (Herology Creative Discovery)

Goal: read the text WRITTEN ON each video ad (captions, supers, titles, stickers, end-card copy) from hook sheets,
then classify the hook. Same method as JD's cd-hook-sheets (claude/creative-discovery-hooks.md).

Input: a batch file (JSON list). Each item = {"sheet": absolute path to a JPEG, "rep": ad id, "ids": [ids sharing that media], "kind": "video"|"poster", "frames": [labels]}.
- kind "video": frames captioned "<last 10 chars of id>  0.0s", 0.5s, 1.0s, 1.5s, 2.0s, 3.0s (hook window), then about 50% and 85% of the duration.
- kind "poster": the video failed; a single still only. Read it as the 0s frame.

For each item open the sheet with the Read tool and decide:
- h (hook_text): on-screen text visible from 0.0s to 3.0s inclusive, verbatim as displayed (keep wording, order, ellipses, case). Join lines with a single space, no repeats when the same text stays across frames. Keep an emoji only if it is part of the text line. If there is no text in 0 to 3s: null.
- o (onscreen_text): all DISTINCT on-screen text across all frames in order, separated by " | ". null if none.
- k (hook_kind): "text" (text in 0 to 3s) or "visual" (no text in 0 to 3s).
- f (hook_format): exactly one of
  Question · Symptom callout (names a symptom, condition or life stage: "PMS?", "Perimenopause symptoms", "If you have PCOS") ·
  POV / Relatable ("POV:", "me when...", meme captions) · Bold claim (a product or brand claim: "The only supplement you need") ·
  Expert intro (a doctor, GP, pharmacist, nutritionist or midwife introduces themselves or speaks as expert) ·
  Testimonial quote (a customer quote or review on screen) · Personal story ("I was exhausted...", "After my second baby") ·
  Social proof / Numbers ("2.4 million women", "50,000 reviews") · Offer / Price first (discount, sale, bundle price leads) ·
  Product reveal (product name or pack is the hook: "Meet BALANCE") · List / Tips ("3 signs...", "How to...") ·
  Myth buster / Mistake ("Stop taking...", "You're doing magnesium wrong") · Results / Before and after ·
  Founder story · Urgency (last chance, ends tonight) · Ingredient focus (an ingredient leads: "Magnesium glycinate vs citrate") ·
  Visual only (use when k = "visual") · Other (unreadable or none of the above)
- What counts as on-screen text: overlays added in the edit. NOT: packaging text, logos or wordmarks alone, background signage, phone UI chrome.
- Never guess or invent. If text is too small or blurry, write what you can read and append " [partly unreadable]".
- You have no headline or copy and must not look them up.

Output: write a JSON object to the output path given in your task, {"<id>": {"h": ..., "o": ..., "k": ..., "f": ...}} with one entry
for EVERY id in "ids" of every item (same values for ids sharing a sheet). Write the file after every 10 sheets (overwrite with all so far)
so work is not lost. Return a short report (under 120 words): sheets done, counts by k, unreadable sheets, 3 example hooks.
