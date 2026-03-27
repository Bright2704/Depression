# Dataset Guide (AU-based Depression Model)

This folder is the data staging area for training a depression-related model
using AU features exported by the FacePsy scan UI.

## Folder layout
```
data/
  exports/   # export JSON files from the app (one per scan)
  labels/    # label files (ground truth)
  dataset/   # generated dataset.csv
```

## What to collect
1. Exported scan JSON files
   - Use the app "Export JSON" button after each scan.
   - Place files in `data/exports/`.

2. Labels (ground truth)
   - Create `data/labels/labels.csv` with at least:
     - `sessionId`: from the exported JSON
     - `phq9_score`: 0-27

### labels.csv format
```
sessionId,phq9_score,userId,scanTimestamp
session_1719999999999_abcd1234,12,user_001,1719999999999
session_1719999999999_efgh5678,3,user_001,1720009999999
```

Notes:
- `userId` is recommended to avoid data leakage during train/test split.
- `scanTimestamp` is optional but helpful if sessionId is missing.

## Synthetic dataset (testing only)
You can create a synthetic dataset to validate the pipeline.
This is NOT real data and should NOT be used to claim accuracy.

```
python /Users/bright/Desktop/Depression/training/generate_synthetic.py \
  --exports /Users/bright/Desktop/Depression/training/data/exports \
  --out /Users/bright/Desktop/Depression/training/data/dataset/dataset.csv \
  --labels /Users/bright/Desktop/Depression/training/data/labels/labels.csv \
  --count 200
```

## How to collect high-quality data
- Ensure a baseline is created for each user before scanning.
- Use consistent lighting and camera position when possible.
- Collect multiple scans over time per user.
- Collect PHQ-9 scores from the same time period as the scan.

## Build dataset
```
python /Users/bright/Desktop/Depression/training/build_dataset.py \
  --exports /Users/bright/Desktop/Depression/training/data/exports \
  --labels /Users/bright/Desktop/Depression/training/data/labels/labels.csv \
  --out /Users/bright/Desktop/Depression/training/data/dataset/dataset.csv
```

## Train model
Classification:
```
python /Users/bright/Desktop/Depression/training/train_model.py \
  --data /Users/bright/Desktop/Depression/training/data/dataset/dataset.csv \
  --task classification \
  --label-col phq9_score \
  --out-model /Users/bright/Desktop/Depression/training/data/dataset/depression_model.joblib \
  --out-meta /Users/bright/Desktop/Depression/training/data/dataset/depression_model_meta.json
```

Regression:
```
python /Users/bright/Desktop/Depression/training/train_model.py \
  --data /Users/bright/Desktop/Depression/training/data/dataset/dataset.csv \
  --task regression \
  --label-col phq9_score \
  --out-model /Users/bright/Desktop/Depression/training/data/dataset/depression_model.joblib \
  --out-meta /Users/bright/Desktop/Depression/training/data/dataset/depression_model_meta.json
```

## Privacy
Only store anonymized IDs and labels. Do not store raw images or personally
identifiable information in this dataset folder.
