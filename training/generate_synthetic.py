import argparse
import json
import os
import random
from glob import glob

import numpy as np
import pandas as pd

from build_dataset import extract_features


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def jitter(val, scale):
    return val + np.random.normal(0, scale)


def synthesize_row(base, idx, user_id):
    row = dict(base)
    row["sessionId"] = f"synthetic_{idx:04d}"
    row["scanTimestamp"] = int(base.get("scanTimestamp", 0) or 0) + (idx + 1) * 60000
    row["userId"] = user_id

    # Feature noise by type
    for key, value in list(row.items()):
        if key in {"sessionId", "scanTimestamp", "userId", "filePath"}:
            continue
        if value is None:
            row[key] = 0.0
            continue
        if key.endswith("_mean") and "AU" in key:
            row[key] = clamp(jitter(value, 0.05), 0.0, 1.0)
        elif key.endswith("_std") and "AU" in key:
            row[key] = clamp(jitter(value, 0.03), 0.0, 0.5)
        elif key.endswith("_min") and "AU" in key:
            row[key] = clamp(jitter(value, 0.05), 0.0, 1.0)
        elif key.endswith("_max") and "AU" in key:
            row[key] = clamp(jitter(value, 0.05), 0.0, 1.0)
        elif key.startswith("head_") and (key.endswith("_mean") or key.endswith("_std")):
            row[key] = jitter(value, 2.0)
        elif key.startswith("head_") and key.endswith("_range"):
            row[key] = clamp(jitter(value, 3.0), 0.0, 40.0)
        elif key == "blink_rate_mean":
            row[key] = clamp(jitter(value, 4.0), 0.0, 40.0)
        elif key == "avg_ear_mean":
            row[key] = clamp(jitter(value, 0.04), 0.1, 0.45)
        elif key == "avg_ear_std":
            row[key] = clamp(jitter(value, 0.02), 0.0, 0.2)
        elif key.startswith("smile_"):
            row[key] = clamp(jitter(value, 0.08), 0.0, 1.0)
        elif key == "expression_variability":
            row[key] = clamp(jitter(value, 0.04), 0.0, 0.5)
        elif key in {"windowCount", "frameCount"}:
            row[key] = int(value) if value else 0
        else:
            # generic small noise
            if isinstance(value, (int, float)):
                row[key] = jitter(value, 0.02)
    return row


def generate_label(row):
    # Heuristic synthetic label (NOT medical ground truth)
    au15 = row.get("AU15_mean", 0)
    au12 = row.get("AU12_mean", 0)
    au06 = row.get("AU06_mean", 0)
    blink = row.get("blink_rate_mean", 15)
    head_range = np.mean([
        row.get("head_pitch_range", 0),
        row.get("head_yaw_range", 0),
        row.get("head_roll_range", 0),
    ])
    smile = max(au12, (au12 + au06) / 2.0)

    risk = 0.0
    risk += au15 * 12.0
    risk += (1.0 - smile) * 8.0
    risk += max(0.0, (10.0 - head_range) / 10.0) * 6.0
    if blink < 10:
        risk += (10 - blink) * 0.4
    if blink > 25:
        risk += (blink - 25) * 0.2

    # add noise and clamp to PHQ-9 range
    risk += np.random.normal(0, 2.0)
    score = int(clamp(round(risk), 0, 27))
    return score


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exports", required=True, help="Folder with export JSONs")
    parser.add_argument("--out", required=True, help="Output dataset CSV")
    parser.add_argument("--labels", required=True, help="Output labels CSV")
    parser.add_argument("--count", type=int, default=200)
    parser.add_argument("--users", type=int, default=10)
    args = parser.parse_args()

    files = sorted(glob(os.path.join(args.exports, "*.json")))
    if not files:
        raise SystemExit(f"No JSON exports found in {args.exports}")

    # Use the first export as the seed
    with open(files[0], "r", encoding="utf-8") as f:
        base_payload = json.load(f)

    base_features = extract_features(base_payload)
    base_features["filePath"] = files[0]

    rows = []
    labels = []
    for i in range(args.count):
        user_id = f"user_{(i % args.users) + 1:02d}"
        row = synthesize_row(base_features, i, user_id)
        label = generate_label(row)
        row["phq9_score"] = label
        rows.append(row)
        labels.append({
            "sessionId": row["sessionId"],
            "phq9_score": label,
            "userId": row["userId"],
            "scanTimestamp": row["scanTimestamp"],
            "label_source": "synthetic_heuristic"
        })

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    os.makedirs(os.path.dirname(args.labels), exist_ok=True)

    pd.DataFrame(rows).to_csv(args.out, index=False)
    pd.DataFrame(labels).to_csv(args.labels, index=False)

    print(f"Wrote synthetic dataset: {args.out} ({len(rows)} rows)")
    print(f"Wrote synthetic labels: {args.labels} ({len(labels)} rows)")


if __name__ == "__main__":
    main()
