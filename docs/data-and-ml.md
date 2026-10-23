# Data and ML

## Task
Given the text of a biological-spray label, decide which of 4 product types it is: `bt`, `trichoderma`, `pseudomonas`, `beauveria`. Or abstain.

## Data
- `data/raw/*.txt` - 26 real public label/product documents (some with the source PDF). Collected from EPA PPLS, CDMS and manufacturer pages.
- `data/sources.csv` - `doc_id, class, title, source_url` for each.
- Class counts: bt 7, trichoderma 7, pseudomonas 7, beauveria 5.
- These texts are third-party documents kept for research and education; they belong to their owners.

## Model
TF-IDF (word 1-2 grams, `min_df=2`, sublinear tf) + multinomial logistic regression (`C=12`). Trained by `ml/train.py`, exported to `ml/artifacts/model.json` (vocabulary, idf, coefficients, threshold 0.45). Served by plain Python (`backend/app/services/classifier.py`) and plain JavaScript (`frontend/src/js/model.js`). Tests prove the Python scorer reproduces scikit-learn.

## Measured results (printed by `ml/train.py`, saved in `ml/artifacts/metrics.json`)
- Leave-one-out cross-validation: 23 of 26 correct = **88.5%**
- One stratified hold-out (7 unseen documents): 5 of 7 = **71.4%**

## Honest limits
- 26 documents is small. The numbers show the model learns the four types from label text. They do **not** show it recognises every product in a shop.
- Camera OCR is noisier than these clean texts.
- Below 45% confidence the app abstains.
- The app does not predict survival. That needs lab data (see `docs/roadmap.md`).

## Add products (the 2-minute path)
1. Put the real label text in `data/raw/<id>.txt`.
2. Add a row to `data/sources.csv` with its class and where the text came from.
3. `pip install -r ml/requirements.txt && python3 ml/train.py && python3 scripts/sync_static.py`
4. Check the printed accuracy. Update the numbers in `README.md` and `docs/` if they changed.

## Add a new product type
Add texts and a class in `sources.csv`, add an entry under `classes` in `data/evidence/evidence.json` (with sources and a photo credit if you add a photo to `CLASS_IMG` in `frontend/src/js/main.js`), retrain, sync, and add a sample to `data/samples.json`.
