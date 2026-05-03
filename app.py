from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from AI_Model.feature_pipeline import (
    NormalizedApplication,
    build_structured_features,
    create_feature_matrix,
    normalize_application_record,
    reasons_from_record,
)

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = ROOT / "AI_Model" / "rf_model.pkl"
DEFAULT_VECTORIZER_PATH = ROOT / "AI_Model" / "tfidf.pkl"
LEGACY_MODEL_PATH = ROOT / "AI_Model" / "random_forest_model.pkl"
LEGACY_VECTORIZER_PATH = ROOT / "AI_Model" / "tfidf_vectorizer.pkl"
MODEL_PATH = Path(os.getenv("AI_MODEL_PATH", DEFAULT_MODEL_PATH))
VECTORIZER_PATH = Path(os.getenv("AI_TFIDF_PATH", DEFAULT_VECTORIZER_PATH))

app = FastAPI(title="Hybrid AI Review Service", version="1.0.0")


class PredictRequest(BaseModel):
    bio: str = ""
    email: str = ""
    links: str | list[str] = Field(default_factory=list)
    account_type: str = ""
    full_name: str = ""
    description: str = ""


class PredictResponse(BaseModel):
    decision: str
    score: float
    confidence: float
    reasons: list[str]
    source: str = "random_forest"


def _first_existing_path(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_artifacts():
    model_path = _first_existing_path([MODEL_PATH, DEFAULT_MODEL_PATH, LEGACY_MODEL_PATH])
    vectorizer_path = _first_existing_path([VECTORIZER_PATH, DEFAULT_VECTORIZER_PATH, LEGACY_VECTORIZER_PATH])

    if model_path is None:
        raise RuntimeError(
            f"Model file not found. Checked: {MODEL_PATH}, {DEFAULT_MODEL_PATH}, {LEGACY_MODEL_PATH}"
        )
    if vectorizer_path is None:
        raise RuntimeError(
            f"Vectorizer file not found. Checked: {VECTORIZER_PATH}, {DEFAULT_VECTORIZER_PATH}, {LEGACY_VECTORIZER_PATH}"
        )

    print(f"Loading model from {model_path}")
    bundle = joblib.load(model_path)
    print("Loaded model successfully")

    print(f"Loading vectorizer from {vectorizer_path}")
    vectorizer = joblib.load(vectorizer_path)
    print("Loaded vectorizer successfully")

    if isinstance(bundle, dict):
        model = bundle.get("model")
        label_encoder = bundle.get("label_encoder")
        structured_feature_names = bundle.get("structured_feature_names")
    else:
        model = bundle
        label_encoder = None
        sample_record = NormalizedApplication(
            application_id=None,
            full_name="",
            email="",
            account_type="",
            bio="",
            description="",
            links=[],
            raw={},
        )
        structured_feature_names = list(build_structured_features(sample_record).keys())

    if model is None or not structured_feature_names:
        raise RuntimeError("Invalid model bundle contents.")
    if hasattr(model, "set_params"):
        model.set_params(n_jobs=1)

    return model, label_encoder, vectorizer, structured_feature_names


def _request_to_record(payload: PredictRequest) -> NormalizedApplication:
    return normalize_application_record(
        {
            "email": payload.email,
            "full_name": payload.full_name,
            "account_type": payload.account_type,
            "bio": payload.bio,
            "links": payload.links,
            "data_json": {
                "type_specific": {
                    "description": payload.description,
                }
            },
        }
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    try:
        model, label_encoder, vectorizer, structured_feature_names = load_artifacts()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    record = _request_to_record(payload)
    feature_matrix = create_feature_matrix([record], vectorizer, structured_feature_names)

    probabilities = model.predict_proba(feature_matrix)[0]
    best_index = int(probabilities.argmax())
    if label_encoder is not None:
        decision = str(label_encoder.inverse_transform([best_index])[0])
    else:
        decision = str(model.classes_[best_index])
    confidence = float(probabilities[best_index])
    score = round(confidence, 4)
    reasons = reasons_from_record(record, decision, confidence)
    print("AI Source = random_forest")

    return PredictResponse(
        decision=decision,
        score=score,
        confidence=confidence,
        reasons=reasons,
        source="random_forest",
    )
