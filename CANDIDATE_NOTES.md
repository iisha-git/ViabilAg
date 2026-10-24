# Expansion candidate - offline review notes (2026-10-24)

Status: NOT DEPLOYED. Live app restored to pre-expansion 4-class build (49d64b3).
This branch preserves the 6-group expansion work + an organism-evidence gate.

## Verdict: expansion BLOCKED at fixed 0.45 threshold
Same images, same pinned tesseract.js 5.1.1 OCR, identical text scored on both models:
- DiPel demo photo: BASE-4 bt 0.496 PASS vs CAND-6 bt 0.436 ABSTAIN (dilution regression)
- RootShield demo photo: BASE-4 trichoderma 0.473 vs CAND-6 0.349
- New-group pack photos (Katyayani BAXIL, Farmroot HeraNPV promo shots): OCR illegible (13-21 chars) - cannot demo new groups from these.

## Gate (organism-evidence), implemented here in backend classifier.py + frontend model.js
Rule: pass requires (a) p >= threshold AND (b) the text literally names the predicted
group's organism (word-boundary); if text names organisms of MORE THAN ONE supported
group, abstain instead of picking one.
Grouped-by-product holdout (whole products hidden, 0.45 threshold):
- BASE-4 (26 docs/14 products): wrong-pass 35% -> 0% with gate; correct-pass 15%.
- CAND-6 (47 docs/34 products): wrong-pass 9% -> 0% with gate; correct-pass 23%.
- CAND-9 (66 docs/53 products): wrong-pass 12% -> 2% with gate; correct-pass 14%.
Unsupported negatives (19 Metarhizium/Verticillium/Paecilomyces docs) on CAND-6:
11/19 false-pass without gate, 0/19 with gate (observed on this testset, not a guarantee).
Known limits: mixed-organism labels (now abstain by rule), OCR garbling of organism
names (conservative failure -> abstain), product-name mentions on other labels.

## Demo-critical gate detail
Real browser OCR of the RootShield photo does NOT reliably contain "Trichoderma"
(it reads "RootShield WP", strain code garbled). A pure organism-term gate would
block the current combination-demo first image. Gate terms must include known
product names per group (e.g. "rootshield", "dipel") - literal label evidence -
or the guard fix breaks the demo it is meant to protect.
