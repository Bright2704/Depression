import argparse
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    matthews_corrcoef,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor


def prepare_data(df, label_col, task):
    df = df.copy()
    df = df.dropna(subset=[label_col])

    # Features = all numeric columns except metadata/labels
    exclude = {
        "sessionId",
        "filePath",
        "scanTimestamp",
        label_col,
    }
    feature_cols = [c for c in df.columns if c not in exclude]

    X = df[feature_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
    y = df[label_col].astype(float)
    if task == "classification":
        y = (y >= 5).astype(int)  # PHQ-9 >= 5 = positive class

    return X, y, feature_cols


def split_data(X, y, df, group_col=None, task="classification"):
    if group_col and group_col in df.columns:
        groups = df[group_col]
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(X, y, groups))
        return train_idx, test_idx

    if task == "classification" and len(np.unique(y)) > 1:
        return train_test_split(
            np.arange(len(X)),
            test_size=0.2,
            random_state=42,
            stratify=y
        )

    # Fallback split
    indices = np.arange(len(X))
    np.random.seed(42)
    np.random.shuffle(indices)
    split = int(len(indices) * 0.8)
    return indices[:split], indices[split:]


def evaluate_classification(y_true, y_pred, y_prob=None):
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "mcc": matthews_corrcoef(y_true, y_pred) if len(np.unique(y_true)) > 1 else 0.0,
    }
    if y_prob is not None and len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = roc_auc_score(y_true, y_prob)
    return metrics


def evaluate_regression(y_true, y_pred):
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    return {
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": rmse,
        "r2": r2_score(y_true, y_pred),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to dataset CSV")
    parser.add_argument("--task", choices=["classification", "regression"], required=True)
    parser.add_argument("--label-col", default="phq9_score")
    parser.add_argument("--group-col", default="userId")
    parser.add_argument("--out-model", required=True)
    parser.add_argument("--out-meta", required=True)
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    X, y, feature_cols = prepare_data(df, args.label_col, args.task)
    train_idx, test_idx = split_data(X, y, df, group_col=args.group_col, task=args.task)

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    if args.task == "classification":
        model = GradientBoostingClassifier(random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else None
        metrics = evaluate_classification(y_test, y_pred, y_prob)
    else:
        model = GradientBoostingRegressor(random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        metrics = evaluate_regression(y_test, y_pred)

    os.makedirs(os.path.dirname(args.out_model), exist_ok=True)
    joblib.dump({"model": model, "features": feature_cols}, args.out_model)

    meta = {
        "task": args.task,
        "label_col": args.label_col,
        "feature_count": len(feature_cols),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "metrics": metrics,
    }
    with open(args.out_meta, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"Saved model: {args.out_model}")
    print(f"Saved meta: {args.out_meta}")
    print("Metrics:", json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
