from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from AI_Model.feature_pipeline import (
    build_structured_features,
    fit_vectorizer,
    normalize_application_record,
    create_feature_matrix,
)

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "rf_model.pkl"
VECTORIZER_PATH = ROOT / "tfidf.pkl"
METRICS_PATH = ROOT / "training_metrics.json"
SEED_DATA_PATH = ROOT / "seed_training_data.json"


def _rest_request(path: str, query: dict[str, str] | None = None) -> list[dict[str, Any]]:
    base_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )
    if not base_url or not key:
        raise RuntimeError("Missing Supabase environment variables for training.")

    url = f"{base_url}/rest/v1/{path}"
    if query:
        url = f"{url}?{urlencode(query)}"

    request = Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Supabase request failed for {path}: {exc.code} {body}") from exc


def fetch_training_rows() -> list[dict[str, Any]]:
    applications = _rest_request(
        "applications",
        {
            "select": "id,user_id,account_type,status,ai_recommendation,data_json,proof_json",
            "order": "created_at.desc",
        },
    )
    profiles = _rest_request("profiles", {"select": "id,full_name,email,account_type"})
    profile_map = {profile["id"]: profile for profile in profiles if profile.get("id")}

    merged_rows: list[dict[str, Any]] = []
    for application in applications:
        application["profile"] = profile_map.get(application.get("user_id")) or {}
        merged_rows.append(application)
    return merged_rows


def load_seed_training_rows() -> list[dict[str, Any]]:
    if not SEED_DATA_PATH.exists():
        return []
    return json.loads(SEED_DATA_PATH.read_text(encoding="utf-8"))


def derive_label(row: dict[str, Any]) -> str:
    status = str(row.get("status") or "").lower()
    ai_recommendation = str(row.get("ai_recommendation") or "").lower()

    if status == "approved":
        return "approve"
    if status == "rejected":
        return "reject"
    if ai_recommendation in {"approve", "reject", "review"}:
        return ai_recommendation
    return "review"


def train_and_save() -> dict[str, Any]:
    rows = fetch_training_rows()
    seed_rows = load_seed_training_rows()
    if len(rows) < 6 and seed_rows:
        print(f"Supabase returned {len(rows)} training rows; using {len(seed_rows)} local seed rows.")
        rows = seed_rows

    normalized_records = [normalize_application_record(row) for row in rows]
    labels = [derive_label(row) for row in rows]

    if len(normalized_records) < 6:
        raise RuntimeError("Need at least 6 training rows to train the classifier.")

    label_counts = Counter(labels)
    if len(label_counts) < 2:
        raise RuntimeError("Training data must contain at least two classes.")

    structured_feature_names = list(build_structured_features(normalized_records[0]).keys())
    texts = [
        f"{record.bio} {record.description}".strip()
        for record in normalized_records
    ]
    vectorizer = fit_vectorizer(texts)
    features = create_feature_matrix(normalized_records, vectorizer, structured_feature_names)

    encoder = LabelEncoder()
    encoded_labels = encoder.fit_transform(labels)

    stratify_labels = encoded_labels if min(label_counts.values()) >= 2 else None
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        encoded_labels,
        test_size=0.25,
        random_state=42,
        stratify=stratify_labels,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        class_weight="balanced",
        random_state=42,
        n_jobs=1,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    report = classification_report(
        y_test,
        predictions,
        labels=list(range(len(encoder.classes_))),
        target_names=list(encoder.classes_),
        zero_division=0,
        output_dict=True,
    )

    joblib.dump(vectorizer, VECTORIZER_PATH)
    joblib.dump(
        {
            "model": model,
            "label_encoder": encoder,
            "structured_feature_names": structured_feature_names,
        },
        MODEL_PATH,
    )

    metrics = {
        "sample_count": len(rows),
        "label_distribution": dict(label_counts),
        "classification_report": report,
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    result = train_and_save()
    print(json.dumps(result, indent=2))
