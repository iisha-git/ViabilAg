# Measured model performance (last training run)

Corpus: 26 real public label/product documents (bt 7, trichoderma 7,
pseudomonas 7, beauveria 5). See data/sources.csv for titles and URLs.

- Leave-one-out cross-validation (26 held-out predictions, each document
  hidden once): 23/26 correct = 88.5%.
  Confusion matrix (rows true, cols predicted; beauveria, bt, pseudomonas,
  trichoderma):
      3 1 0 1
      0 7 0 0
      0 0 7 0
      0 0 1 6
- Stratified 25% hold-out (7 documents the model never trained on):
  5/7 correct = 71.4%.

Caveats: small corpus; whole-document level split (no chunks of one label in
both train and test); camera OCR noise can differ from these texts. The app
treats model output as a reading aid and stops below 45% confidence.
