# Measured model performance (last training run)

Corpus: 47 real public label/product documents (bt 9, trichoderma 8,
pseudomonas 8, beauveria 6, bacillus_subtilis 8, npv 8). See data/sources.csv
for titles and URLs. New in this run: Bacillus subtilis and NPV virus sprays,
plus Indian label/product text (Delfin, Biolep, T. Stanes BioCure-F/B, BioPower)
for the original four classes.

- Leave-one-out cross-validation (47 held-out predictions, each document
  hidden once): 33/47 correct = 70.2%.
- Stratified 25% hold-out (12 documents the model never trained on):
  8/12 correct = 66.7%.

Per-class leave-one-out recall (share of that class's documents identified
correctly when hidden):

| Class | Docs | LOO recall |
|---|---|---|
| bt | 9 | 89% |
| trichoderma | 8 | 75% |
| pseudomonas | 8 | 62% |
| beauveria | 6 | 50% |
| bacillus_subtilis | 8 | 62% |
| npv | 8 | 75% |

Researched but NOT shipped in this run (sources kept in
data/candidates_not_shipped.csv): Metarhizium anisopliae, Verticillium
lecanii, Paecilomyces lilacinus. With 4-8 real documents each, the model
confused Metarhizium and Verticillium with Beauveria (all are
insect-killing fungi with near-identical label language) and never passed
Paecilomyces above the 45% app threshold. Shipping them would have meant
guessing, so they wait for a larger, more distinct corpus.

Caveats: small corpus; whole-document level split (no chunks of one label in
both train and test); some classes include a label plus a product page for
the same product, which can flatter cross-validation; camera OCR noise can
differ from these texts; merchant pages carry shop boilerplate. The scores
below are uncalibrated model scores from this corpus - they are not
measured real-world accuracy, and they say nothing about microbial
viability or product quality. The app treats model output as a reading aid
and stops below 45% confidence.

## Generalization checks (added after first publish of this run)

Two harder evaluations, because document-level splits can flatter small
corpora:

- Grouped-by-product holdout: every document of one product (label,
  product page, quick sheet) is hidden together, so the model can only win
  by recognising the organism type, not the product. Result: 26/47 correct
  = 55.3%. Per-class recall: bt 89%, npv 75%, trichoderma 62%,
  bacillus_subtilis 50%, beauveria 50%, pseudomonas 0% (the model only
  recognises the specific Pseudomonas products it trained on; held-out
  ones fall below the 45% threshold and abstain rather than guess).
- Unsupported-group negative tests: the 19 sourced documents for the three
  NOT-shipped groups (Metarhizium, Verticillium, Paecilomyces) were scored
  against the shipped model. 11 of 19 pass the 45% threshold with a WRONG
  group (e.g. a Metarhizium page reads as "Beauveria" at 51%). This is the
  main open risk of this version: a common Indian Metarhizium or
  Verticillium product can get a confident wrong answer instead of an
  abstention. It argues for shipping those groups with a larger corpus in
  a future version rather than leaving them out.
