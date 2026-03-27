import argparse
import json
import os
from glob import glob

import numpy as np
import pandas as pd

AU_KEYS = [
    "AU01", "AU02", "AU04", "AU06", "AU07", "AU10",
    "AU12", "AU14", "AU15", "AU17", "AU23", "AU24",
]


def safe_mean(values):
    return float(np.nanmean(values)) if len(values) else 0.0


def safe_std(values):
    return float(np.nanstd(values)) if len(values) else 0.0


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_features(payload):
    model = payload.get("model", {}) or {}
    raw = model.get("rawSummary", {}) or {}
    window_stats = model.get("windowStats", []) or []
    baseline = model.get("baseline") or {}

    features = {}
    features["sessionId"] = payload.get("sessionId") or ""
    features["scanTimestamp"] = payload.get("scanTimestamp") or 0
    features["userId"] = baseline.get("userId") if isinstance(baseline, dict) else ""
    features["windowCount"] = len(window_stats)
    features["frameCount"] = raw.get("frameCount") or int(sum(w.get("frameCount", 0) for w in window_stats))

    # Compute avg FPS per window (if timestamps present)
    fps_values = []
    for w in window_stats:
        start = w.get("windowStart")
        end = w.get("windowEnd")
        frames = w.get("frameCount", 0)
        if start and end and end > start:
            duration_sec = max(1e-6, (end - start) / 1000)
            fps_values.append(frames / duration_sec)
    features["avgFps"] = safe_mean(fps_values)

    # Head pose aggregates
    for axis in ["pitch", "yaw", "roll"]:
        means = [w.get("headPose", {}).get(axis, {}).get("mean", 0) for w in window_stats]
        stds = [w.get("headPose", {}).get(axis, {}).get("std", 0) for w in window_stats]
        ranges = [w.get("headPose", {}).get(axis, {}).get("range", 0) for w in window_stats]
        features[f"head_{axis}_mean"] = safe_mean(means)
        features[f"head_{axis}_std"] = safe_mean(stds)
        features[f"head_{axis}_range"] = safe_mean(ranges)

    # Eye metrics
    blink_rates = [w.get("eyeMetrics", {}).get("blinkRate", 0) for w in window_stats]
    ear_means = [w.get("eyeMetrics", {}).get("avgEAR", {}).get("mean", 0) for w in window_stats]
    ear_stds = [w.get("eyeMetrics", {}).get("avgEAR", {}).get("std", 0) for w in window_stats]
    features["blink_rate_mean"] = safe_mean(blink_rates)
    features["avg_ear_mean"] = safe_mean(ear_means)
    features["avg_ear_std"] = safe_mean(ear_stds)

    # Smile
    smile_means = [w.get("smileProbability", {}).get("mean", 0) for w in window_stats]
    smile_stds = [w.get("smileProbability", {}).get("std", 0) for w in window_stats]
    features["smile_mean"] = safe_mean(smile_means)
    features["smile_std"] = safe_mean(smile_stds)

    # AU aggregates
    for key in AU_KEYS:
        au_means = []
        au_stds = []
        for w in window_stats:
            au = w.get("actionUnits", {}).get(key, {})
            au_means.append(au.get("mean", 0))
            au_stds.append(au.get("std", 0))
        features[f"{key}_mean"] = safe_mean(au_means)
        features[f"{key}_std"] = safe_mean(au_stds)
        features[f"{key}_min"] = float(np.nanmin(au_means)) if len(au_means) else 0.0
        features[f"{key}_max"] = float(np.nanmax(au_means)) if len(au_means) else 0.0

    # Expression variability (if available in raw summary)
    expr_var = raw.get("expressionVariability")
    if expr_var is None:
        # fallback: mean of AU stds across all windows
        all_std = []
        for w in window_stats:
            for key in AU_KEYS:
                all_std.append(w.get("actionUnits", {}).get(key, {}).get("std", 0))
        expr_var = safe_mean(all_std)
    features["expression_variability"] = float(expr_var) if expr_var is not None else 0.0

    return features


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exports", required=True, help="Path to folder with export JSON files")
    parser.add_argument("--labels", required=False, help="CSV with labels (sessionId, phq9_score, optional userId)")
    parser.add_argument("--out", required=True, help="Output CSV path")
    args = parser.parse_args()

    files = sorted(glob(os.path.join(args.exports, "*.json")))
    if not files:
        raise SystemExit(f"No JSON files found in {args.exports}")

    rows = []
    for path in files:
        payload = load_json(path)
        feat = extract_features(payload)
        feat["filePath"] = path
        rows.append(feat)

    df = pd.DataFrame(rows)

    if args.labels and os.path.exists(args.labels):
        labels = pd.read_csv(args.labels)
        # Try to match by sessionId first
        if "sessionId" in labels.columns:
            df = df.merge(labels, on="sessionId", how="left")
        elif "scanTimestamp" in labels.columns:
            df = df.merge(labels, on="scanTimestamp", how="left")

    df.to_csv(args.out, index=False)
    print(f"Wrote dataset: {args.out} ({len(df)} rows)")


if __name__ == "__main__":
    main()
