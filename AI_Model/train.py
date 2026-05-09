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


def make_training_row(
    row_id: str,
    account_type: str,
    label: str,
    full_name: str,
    email: str,
    bio: str,
    type_specific: dict[str, Any],
    proof_links: list[str | None],
) -> dict[str, Any]:
    return {
        "id": row_id,
        "user_id": "generated-seed-user",
        "account_type": account_type,
        "status": "approved" if label == "approve" else "rejected" if label == "reject" else "pending",
        "ai_recommendation": label,
        "data_json": {
            "basic": {
                "full_name": full_name,
                "email": email,
                "bio": bio,
            },
            "type_specific": type_specific,
        },
        "proof_json": {
            "proof_link_1": proof_links[0] if proof_links else None,
            "proof_link_2": proof_links[1] if len(proof_links) > 1 else None,
        },
    }


def generate_augmented_seed_rows() -> list[dict[str, Any]]:
    approve_projects = [
        ("Mira Sweets", "food", "weekly dessert orders, menu photos, customer reviews, delivery notes"),
        ("Layan Candles", "handmade", "regular handmade product posts, customer feedback, packaging photos, repeat orders"),
        ("Olive Craft", "crafts", "finished products, price list, real customer photos, social page activity"),
        ("Rana Soap", "beauty products", "ingredient list, product batches, public photos, buyer messages"),
        ("Nour Plants", "plants", "catalog photos, care instructions, delivery records, customer comments"),
        ("Heba Embroidery", "handmade", "custom orders, product albums, clear pricing, public customer feedback"),
        ("Sama Bakery", "food", "active weekly orders, public menu, customer reviews, clear packaging costs"),
        ("Dalia Studio", "art", "portfolio posts, completed orders, customer screenshots, clear service packages"),
    ]
    approve_merchants = [
        ("Tala Accessories", "accessories", "organized product categories, clear prices, active Instagram orders"),
        ("Aseel Kids", "clothes", "size charts, product albums, delivery policy, repeat customers"),
        ("Huda Stationery", "stationery", "public catalog, order form, school bundles, customer messages"),
        ("Rima Beauty", "beauty products", "skincare product details, public page, order history, clear contact"),
        ("Adam Gadgets", "electronics", "product specs, prices, delivery notes, customer questions"),
        ("Green Home", "home products", "clear product photos, customer feedback, delivery options"),
        ("Lina Gifts", "gifts", "custom gift examples, price list, public page, buyer reviews"),
        ("Noor Fashion", "fashion", "product photos, sizes, prices, social proof, delivery terms"),
    ]
    approve_delivery = [
        ("City Express", "local", "named delivery cities, customer confirmations, pickup schedule, driver details"),
        ("Quick Runner", "local", "same day delivery notes, public contact number, customer messages, clear coverage"),
        ("Safe Drop", "local", "delivery proof screenshots, fixed service areas, response hours, transparent fees"),
        ("Market Courier", "local", "merchant partnerships, order tracking notes, contact details, delivery policy"),
    ]
    approve_supporters = [
        ("Maya Mentor", "consulting", "public professional profile, previous sessions, references from entrepreneurs"),
        ("Growth Partner", "marketing", "documented mentoring work, clear interests, business support history"),
        ("Retail Advisor", "consulting", "known profile, previous shop consulting, practical pricing experience"),
        ("Seed Support", "partnerships", "clear partnership interests, public contact profile, documented past help"),
    ]
    email_domains = [
        "gmail.com",
        "outlook.com",
        "hotmail.com",
        "business.ps",
        "shop.ps",
        "example.com",
    ]
    review_cases = [
        ("New Cake Idea", "small_business", "food", "I have sample photos and a social page, but regular order history is still limited."),
        ("Trial Gadget Page", "merchant", "electronics", "The page has some product photos, but supplier information and order proof are incomplete."),
        ("Early Delivery", "delivery", "local", "I deliver in one city and have customer chats, but public proof is still new."),
        ("Part Time Mentor", "supporter", "consulting", "I have some advice experience, but references and profile proof need confirmation."),
        ("Fresh Fashion", "merchant", "fashion", "The shop is plausible and has products, but customer activity is still very low."),
    ]
    reject_cases = [
        ("Fast Cash Deal", "merchant", "other", "quick profit pay now no address no products no page", "fastcash9999@tempmail.com"),
        ("Money Please", "small_business", "other", "need money urgent no project no proof no details", "money7777@mailinator.com"),
        ("Anonymous Fund", "supporter", "other", "I fund anyone privately no documents no verification", "anon4444@trashmail.com"),
        ("No City Delivery", "delivery", "unknown", "cheap delivery anywhere no phone no cities no license", "ship0000@tempmail.com"),
        ("Fake Luxury", "merchant", "other", "original luxury very cheap transfer before delivery", "luxury123456@gmail.com"),
    ]
    invalid_link_reject_cases = [
        ("Code Repo Store", "merchant", "electronics", "The applicant provided a code repository instead of a store page or social proof.", "https://github.com/example/project"),
        ("Developer Portfolio Shop", "merchant", "fashion", "The link is a personal developer portfolio and does not show products, prices, orders, or customers.", "https://codepen.io/example"),
        ("GitLab Business Proof", "small_business", "technology", "The proof link points to source code, not to a real project page with customers or business activity.", "https://gitlab.com/example/project"),
        ("Stack Profile Merchant", "merchant", "other", "The submitted proof is a technical Q and A profile, not a store or social media page.", "https://stackoverflow.com/users/12345/example"),
        ("Package Page Seller", "merchant", "software", "The proof link is a package registry page and does not prove commercial marketplace activity.", "https://npmjs.com/package/example"),
    ]

    rows: list[dict[str, Any]] = []

    for index in range(620):
        name, field, proof = approve_projects[index % len(approve_projects)]
        slug = f"{name.lower().replace(' ', '_')}_{index}"
        email_domain = email_domains[index % len(email_domains)]
        rows.append(
            make_training_row(
                f"generated-approve-project-{index:03d}",
                "small_business",
                "approve",
                f"{name} {index}",
                f"{slug}@{email_domain}",
                f"I run a real small project with {proof}, clear costs, and a practical plan to grow sales gradually.",
                {
                    "project_name": name,
                    "project_field": field,
                    "project_stage": "running",
                    "needs": ["marketing", "packaging"],
                    "social_link": f"https://instagram.com/{slug}",
                },
                [f"https://instagram.com/{slug}", f"https://facebook.com/{slug}"],
            )
        )

    for index in range(620):
        name, category, proof = approve_merchants[index % len(approve_merchants)]
        slug = f"{name.lower().replace(' ', '_')}_{index}"
        email_domain = email_domains[(index + 2) % len(email_domains)]
        rows.append(
            make_training_row(
                f"generated-approve-merchant-{index:03d}",
                "merchant",
                "approve",
                f"{name} {index}",
                f"{slug}@{email_domain}",
                f"I manage an active online shop with {proof}, consistent brand name, and a clear plan for restocking.",
                {
                    "store_name": name,
                    "product_category": category,
                    "store_link": f"https://instagram.com/{slug}",
                    "commercial_reg_no": "home_based",
                },
                [f"https://instagram.com/{slug}", f"https://facebook.com/{slug}"],
            )
        )

    for index in range(100):
        name, scope, proof = approve_delivery[index % len(approve_delivery)]
        slug = f"{name.lower().replace(' ', '_')}_{index}"
        rows.append(
            make_training_row(
                f"generated-approve-delivery-{index:03d}",
                "delivery",
                "approve",
                f"{name} {index}",
                f"{slug}@{email_domains[(index + 3) % len(email_domains)]}",
                f"We provide a real delivery service with {proof}, reachable social pages, and clear average delivery time.",
                {
                    "company_name": name,
                    "delivery_scope": scope,
                    "delivery_cities": ["Ramallah", "Hebron", "Nablus"],
                    "avg_delivery_time": "same_day",
                    "license_no": "municipality_registered",
                },
                [f"https://facebook.com/{slug}", f"https://instagram.com/{slug}"],
            )
        )

    for index in range(100):
        name, support_type, proof = approve_supporters[index % len(approve_supporters)]
        slug = f"{name.lower().replace(' ', '_')}_{index}"
        rows.append(
            make_training_row(
                f"generated-approve-supporter-{index:03d}",
                "supporter",
                "approve",
                f"{name} {index}",
                f"{slug}@{email_domains[(index + 4) % len(email_domains)]}",
                f"I support small businesses with {proof}, clear support areas, and verifiable communication channels.",
                {
                    "support_type": support_type,
                    "funding_range": "1000_5000",
                    "interests": "small business growth, marketing, operations",
                    "professional_link": f"https://linkedin.com/in/{slug}",
                    "previous_experience": "Worked with several small businesses on practical improvements.",
                },
                [f"https://linkedin.com/in/{slug}", f"https://facebook.com/{slug}"],
            )
        )

    for index in range(300):
        name, account_type, field, bio = review_cases[index % len(review_cases)]
        slug = f"{name.lower().replace(' ', '_')}_{index}"
        type_specific = (
            {
                "project_name": name,
                "project_field": field,
                "project_stage": "idea",
                "needs": ["marketing"],
                "social_link": f"https://instagram.com/{slug}",
            }
            if account_type == "small_business"
            else {
                "store_name": name,
                "product_category": field,
                "store_link": f"https://instagram.com/{slug}",
                "commercial_reg_no": "",
            }
        )
        rows.append(
            make_training_row(
                f"generated-review-{index:03d}",
                account_type,
                "review",
                f"{name} {index}",
                f"{slug}@gmail.com",
                bio,
                type_specific,
                [f"https://instagram.com/{slug}", None],
            )
        )

    for index in range(218):
        name, account_type, field, bio, email = reject_cases[index % len(reject_cases)]
        rows.append(
            make_training_row(
                f"generated-reject-{index:03d}",
                account_type,
                "reject",
                f"{name} {index}",
                email.replace("@", f"{index}@"),
                bio,
                {
                    "store_name": "" if account_type == "merchant" else name,
                    "project_name": "" if account_type == "small_business" else name,
                    "product_category": field,
                    "project_field": field,
                    "store_link": "",
                    "social_link": "",
                    "commercial_reg_no": "",
                },
                [None, None],
            )
        )

    for index in range(120):
        name, account_type, field, bio, link = invalid_link_reject_cases[index % len(invalid_link_reject_cases)]
        slug = f"{name.lower().replace(' ', '_')}_{index}"
        rows.append(
            make_training_row(
                f"generated-reject-invalid-link-{index:03d}",
                account_type,
                "reject",
                f"{name} {index}",
                f"{slug}@gmail.com",
                bio,
                {
                    "store_name": name if account_type == "merchant" else "",
                    "project_name": name if account_type == "small_business" else "",
                    "product_category": field,
                    "project_field": field,
                    "store_link": link if account_type == "merchant" else "",
                    "social_link": link if account_type == "small_business" else "",
                    "commercial_reg_no": "",
                },
                [link, None],
            )
        )

    return rows


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
    seed_rows = load_seed_training_rows()
    augmented_seed_rows = generate_augmented_seed_rows()
    try:
        rows = fetch_training_rows()
    except RuntimeError as exc:
        print(f"Could not fetch Supabase training rows: {exc}")
        rows = []

    local_rows = seed_rows + augmented_seed_rows
    if local_rows:
        print(f"Using {len(rows)} Supabase rows + {len(local_rows)} local seed rows.")
        merged_by_id = {
            str(row.get("id") or f"supabase-{index}"): row
            for index, row in enumerate(rows)
        }
        for index, row in enumerate(local_rows):
            merged_by_id[str(row.get("id") or f"local-seed-{index}")] = row
        rows = list(merged_by_id.values())

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
