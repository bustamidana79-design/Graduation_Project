from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.parse import urlparse

import numpy as np
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import TfidfVectorizer

FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "yahoo.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
}

RANDOM_NUMBER_THRESHOLD = 4


@dataclass
class NormalizedApplication:
    application_id: str | None
    full_name: str
    email: str
    account_type: str
    bio: str
    description: str
    links: list[str]
    raw: dict[str, Any]


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return " ".join(_as_text(item) for item in value if _as_text(item))
    return ""


def _extract_links(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        matches = re.findall(r"https?://[^\s,]+", value)
        if matches:
            return matches
        if value.strip().startswith(("http://", "https://")):
            return [value.strip()]
        return []
    if isinstance(value, list):
        links: list[str] = []
        for item in value:
            links.extend(_extract_links(item))
        return links
    if isinstance(value, dict):
        links: list[str] = []
        for item in value.values():
            links.extend(_extract_links(item))
        return links
    return []


def _collect_description_text(account_type: str, type_specific: dict[str, Any]) -> str:
    prioritized_keys = {
        "merchant": ["store_name", "product_category", "store_link", "commercial_reg_no"],
        "small_business": ["project_name", "project_field", "project_stage", "needs", "social_link"],
        "delivery": ["company_name", "delivery_scope", "delivery_cities", "avg_delivery_time", "license_no"],
        "supporter": [
            "support_type",
            "funding_range",
            "interests",
            "professional_link",
            "previous_experience",
        ],
    }

    values = [_as_text(type_specific.get(key)) for key in prioritized_keys.get(account_type, [])]
    fallback_values = [_as_text(value) for value in type_specific.values()]
    merged = [value for value in values + fallback_values if value]

    seen: set[str] = set()
    unique_values: list[str] = []
    for value in merged:
        if value not in seen:
            seen.add(value)
            unique_values.append(value)
    return " ".join(unique_values)


def normalize_application_record(record: dict[str, Any]) -> NormalizedApplication:
    data_json = record.get("data_json") or {}
    proof_json = record.get("proof_json") or {}
    basic = data_json.get("basic") or {}
    type_specific = data_json.get("type_specific") or {}
    profile = record.get("profile") or {}

    bio = _as_text(record.get("bio") or basic.get("bio") or profile.get("bio"))
    full_name = _as_text(record.get("full_name") or basic.get("full_name") or profile.get("full_name"))
    email = _as_text(record.get("email") or basic.get("email") or profile.get("email")).lower()
    account_type = _as_text(
        record.get("account_type") or basic.get("account_type") or profile.get("account_type")
    ).lower()
    description = _collect_description_text(account_type, type_specific)

    links = []
    links.extend(_extract_links(record.get("links")))
    links.extend(_extract_links(proof_json.get("proof_link_1")))
    links.extend(_extract_links(proof_json.get("proof_link_2")))
    links.extend(_extract_links(proof_json.get("file_urls")))
    links.extend(_extract_links(type_specific))

    deduped_links: list[str] = []
    for link in links:
        if link not in deduped_links:
            deduped_links.append(link)

    return NormalizedApplication(
        application_id=_as_text(record.get("id")) or None,
        full_name=full_name,
        email=email,
        account_type=account_type,
        bio=bio,
        description=description,
        links=deduped_links,
        raw=record,
    )


def build_text_corpus(record: NormalizedApplication) -> str:
    return " ".join(part for part in [record.bio, record.description] if part).strip()


def _email_domain(email: str) -> str:
    if "@" not in email:
        return ""
    return email.split("@", 1)[1].lower().strip()


def _email_local_part(email: str) -> str:
    if "@" not in email:
        return email.lower().strip()
    return email.split("@", 1)[0].lower().strip()


def _link_domains(links: Iterable[str]) -> list[str]:
    domains: list[str] = []
    for link in links:
        try:
            domain = urlparse(link).netloc.lower()
        except ValueError:
            domain = ""
        domain = domain.removeprefix("www.")
        if domain:
            domains.append(domain)
    return domains


def build_structured_features(record: NormalizedApplication) -> dict[str, float]:
    bio_words = re.findall(r"\w+", record.bio, flags=re.UNICODE)
    description_words = re.findall(r"\w+", record.description, flags=re.UNICODE)
    email_local = _email_local_part(record.email)
    link_domains = _link_domains(record.links)
    digit_count = sum(char.isdigit() for char in email_local)
    unique_link_domains = sorted(set(link_domains))

    return {
        "bio_length": float(len(record.bio)),
        "bio_word_count": float(len(bio_words)),
        "description_length": float(len(record.description)),
        "description_word_count": float(len(description_words)),
        "full_name_length": float(len(record.full_name)),
        "has_links": float(bool(record.links or "http" in record.bio.lower())),
        "link_count": float(len(record.links)),
        "unique_link_domains": float(len(unique_link_domains)),
        "has_email_match": 1.0,
        "has_random_numbers": float(digit_count >= RANDOM_NUMBER_THRESHOLD),
        "email_digit_count": float(digit_count),
        "email_domain_is_free": 0.0,
        "bio_has_http": float("http" in record.bio.lower()),
        "bio_has_contact_hint": float(
            any(token in record.bio.lower() for token in ["@", "whatsapp", "instagram", "facebook", "linkedin"])
        ),
    }


def fit_vectorizer(texts: list[str], max_features: int = 1200) -> TfidfVectorizer:
    vectorizer = TfidfVectorizer(max_features=max_features, ngram_range=(1, 2), min_df=1)
    vectorizer.fit(texts)
    return vectorizer


def create_feature_matrix(
    records: list[NormalizedApplication],
    vectorizer: TfidfVectorizer,
    structured_feature_names: list[str],
):
    texts = [build_text_corpus(record) for record in records]
    tfidf_matrix = vectorizer.transform(texts)
    structured_rows = []
    for record in records:
        feature_map = build_structured_features(record)
        structured_rows.append([feature_map[name] for name in structured_feature_names])

    structured_matrix = csr_matrix(np.asarray(structured_rows, dtype=float))
    return hstack([structured_matrix, tfidf_matrix], format="csr")


def reasons_from_record(record: NormalizedApplication, decision: str, confidence: float) -> list[str]:
    features = build_structured_features(record)
    reasons: list[str] = []

    if features["bio_word_count"] < 8:
        reasons.append("bio too short")
    if not features["has_links"]:
        reasons.append("no links provided")
    if features["has_random_numbers"]:
        reasons.append("suspicious email")
    if features["description_word_count"] < 4:
        reasons.append("project or store description is limited")

    if not reasons:
        if decision == "approve":
            reasons.append("bio and business description look sufficiently detailed")
        elif decision == "reject":
            reasons.append("multiple weak trust signals were detected")
        else:
            reasons.append("mixed signals require manual review")

    if confidence < 0.6 and "mixed signals require manual review" not in reasons:
        reasons.append("model confidence is moderate")

    return reasons[:4]
