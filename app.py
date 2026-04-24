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
    create_feature_matrix,
    normalize_application_record,
    reasons_from_record,
)

ROOT = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("AI_MODEL_PATH", ROOT / "AI_Model" / "rf_model.pkl"))
VECTORIZER_PATH = Path(os.getenv("AI_TFIDF_PATH", ROOT / "AI_Model" / "tfidf.pkl"))

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


@lru_cache(maxsize=1)
def load_artifacts():
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")
    if not VECTORIZER_PATH.exists():
        raise RuntimeError(f"Vectorizer file not found: {VECTORIZER_PATH}")

    bundle = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)

    model = bundle.get("model")
    label_encoder = bundle.get("label_encoder")
    structured_feature_names = bundle.get("structured_feature_names")

    if model is None or label_encoder is None or not structured_feature_names:
        raise RuntimeError("Invalid model bundle contents.")

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
    decision = str(label_encoder.inverse_transform([best_index])[0])
    confidence = float(probabilities[best_index])
    score = round(confidence, 4)
    reasons = reasons_from_record(record, decision, confidence)

    return PredictResponse(
        decision=decision,
        score=score,
        confidence=confidence,
        reasons=reasons,
    )
