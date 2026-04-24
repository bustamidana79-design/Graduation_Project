# Hybrid AI System

## Files

- `train.py`: pulls training data from Supabase, builds TF-IDF + engineered features, trains `RandomForestClassifier`, and saves artifacts.
- `feature_pipeline.py`: shared normalization and feature engineering logic.
- `../app.py`: FastAPI service with `POST /predict`.

## Required env vars for training

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Train

```bash
venv\\Scripts\\python.exe AI_Model\\train.py
```

Artifacts written:

- `AI_Model/rf_model.pkl`
- `AI_Model/tfidf.pkl`
- `AI_Model/training_metrics.json`

## Run API

```bash
venv\\Scripts\\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

## Predict payload

```json
{
  "bio": "Store owner with 3 years of experience in handmade products.",
  "email": "owner@example.com",
  "links": ["https://instagram.com/example_store"],
  "account_type": "merchant",
  "full_name": "Example Store",
  "description": "handmade products retail"
}
```
