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

NON_BUSINESS_PROOF_DOMAINS = {
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "stackoverflow.com",
    "stackexchange.com",
    "codepen.io",
    "codesandbox.io",
    "replit.com",
    "npmjs.com",
    "pypi.org",
    "medium.com",
    "notion.site",
}


@dataclass
class NormalizedApplication:
    application_id: str | None
    full_name: str
    email: str
    account_type: str
    bio: str
    description: str
    links: list[str]
    image_professionalism_score: float
    image_matches_category: float
    image_confidence: float
    number_of_uploaded_images: float
    image_quality_score: float
    image_mismatch_count: float
    image_has_warnings: float
    image_manipulation_risk: float
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


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, numeric)


def _normalize_score(value: Any, default: float = 0.0) -> float:
    numeric = _as_float(value, default)
    if 0.0 <= numeric <= 1.0:
        numeric *= 100.0
    return max(0.0, min(100.0, numeric))


def _boolean_match_value(value: Any) -> float:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "match", "matched", "نعم", "متطابق"}:
            return 1.0
        if normalized in {"false", "no", "mismatch", "not matched", "لا", "غير متطابق"}:
            return 0.0
    return 0.5


def _image_features_from_record(record: dict[str, Any], proof_json: dict[str, Any]) -> dict[str, float]:
    explicit_features = record.get("image_features") or {}
    image_analysis = record.get("image_analysis") or []
    file_urls = proof_json.get("file_urls")

    if isinstance(explicit_features, dict) and explicit_features:
        uploaded_count = _as_float(
            explicit_features.get("number_of_uploaded_images"),
            float(len(file_urls or [])) if isinstance(file_urls, list) else 0.0,
        )
        return {
            "image_professionalism_score": _normalize_score(explicit_features.get("image_professionalism_score")),
            "image_matches_category": max(0.0, min(1.0, _as_float(explicit_features.get("image_matches_category")))),
            "image_confidence": max(0.0, min(1.0, _as_float(explicit_features.get("image_confidence")))),
            "number_of_uploaded_images": uploaded_count,
            "image_quality_score": _normalize_score(explicit_features.get("image_quality_score")),
            "image_mismatch_count": _as_float(explicit_features.get("image_mismatch_count")),
            "image_has_warnings": 1.0 if _as_float(explicit_features.get("image_has_warnings")) > 0 else 0.0,
            "image_manipulation_risk": 1.0 if _as_float(explicit_features.get("image_manipulation_risk")) > 0 else 0.0,
        }

    if not isinstance(image_analysis, list) or not image_analysis:
        return {
            "image_professionalism_score": 0.0,
            "image_matches_category": 0.0,
            "image_confidence": 0.0,
            "number_of_uploaded_images": float(len(file_urls or [])) if isinstance(file_urls, list) else 0.0,
            "image_quality_score": 0.0,
            "image_mismatch_count": 0.0,
            "image_has_warnings": 0.0,
            "image_manipulation_risk": 0.0,
        }

    professionalism_scores: list[float] = []
    quality_scores: list[float] = []
    confidence_scores: list[float] = []
    match_scores: list[float] = []
    mismatch_count = 0.0
    warning_count = 0.0
    manipulation_count = 0.0

    for image in image_analysis:
        if not isinstance(image, dict):
            continue
        professionalism_scores.append(_normalize_score(image.get("professionalism_score")))
        quality_scores.append(_normalize_score(image.get("quality_score") or image.get("professionalism_score")))
        confidence_scores.append(_normalize_score(image.get("confidence")) / 100.0)
        match_value = _boolean_match_value(image.get("matches_project", image.get("matches_business")))
        match_scores.append(match_value)
        if match_value == 0.0:
            mismatch_count += 1.0
        if image.get("warnings"):
            warning_count += 1.0
        if image.get("photoshop_detected") or image.get("authenticity") == "fake":
            manipulation_count += 1.0

    def avg(values: list[float]) -> float:
        return round(sum(values) / len(values), 4) if values else 0.0

    return {
        "image_professionalism_score": avg(professionalism_scores),
        "image_matches_category": avg(match_scores),
        "image_confidence": avg(confidence_scores),
        "number_of_uploaded_images": float(len(image_analysis)),
        "image_quality_score": avg(quality_scores),
        "image_mismatch_count": mismatch_count,
        "image_has_warnings": 1.0 if warning_count > 0 else 0.0,
        "image_manipulation_risk": 1.0 if manipulation_count > 0 else 0.0,
    }


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
    image_features = _image_features_from_record(record, proof_json)

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
        image_professionalism_score=image_features["image_professionalism_score"],
        image_matches_category=image_features["image_matches_category"],
        image_confidence=image_features["image_confidence"],
        number_of_uploaded_images=image_features["number_of_uploaded_images"],
        image_quality_score=image_features["image_quality_score"],
        image_mismatch_count=image_features["image_mismatch_count"],
        image_has_warnings=image_features["image_has_warnings"],
        image_manipulation_risk=image_features["image_manipulation_risk"],
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


def _domain_matches(domain: str, candidate: str) -> bool:
    return domain == candidate or domain.endswith(f".{candidate}")


def _has_non_business_proof_domain(domains: Iterable[str]) -> bool:
    return any(
        _domain_matches(domain, candidate)
        for domain in domains
        for candidate in NON_BUSINESS_PROOF_DOMAINS
    )


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
        "has_non_business_proof_domain": float(_has_non_business_proof_domain(unique_link_domains)),
        "has_email_match": 1.0,
        "has_random_numbers": float(digit_count >= RANDOM_NUMBER_THRESHOLD),
        "email_digit_count": float(digit_count),
        "email_domain_is_free": 0.0,
        "bio_has_http": float("http" in record.bio.lower()),
        "bio_has_contact_hint": float(
            any(token in record.bio.lower() for token in ["@", "whatsapp", "instagram", "facebook", "linkedin"])
        ),
        "image_professionalism_score": float(record.image_professionalism_score),
        "image_matches_category": float(record.image_matches_category),
        "image_confidence": float(record.image_confidence),
        "number_of_uploaded_images": float(record.number_of_uploaded_images),
        "image_quality_score": float(record.image_quality_score),
        "image_mismatch_count": float(record.image_mismatch_count),
        "image_has_warnings": float(record.image_has_warnings),
        "image_manipulation_risk": float(record.image_manipulation_risk),
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
    if features["has_non_business_proof_domain"]:
        reasons.append("proof link is not a business or social page")
    if features["number_of_uploaded_images"] > 0 and features["image_matches_category"] == 0:
        reasons.append("uploaded images do not match project category")
    if features["image_manipulation_risk"]:
        reasons.append("uploaded images may be manipulated")
    if decision != "approve" and features["description_word_count"] < 4:
        reasons.append("project or store description is limited")

    if not reasons:
        if decision == "approve":
            if features["number_of_uploaded_images"] > 0 and features["image_professionalism_score"] >= 70:
                reasons.append("uploaded images look professional and relevant")
            else:
                reasons.append("bio and business description look sufficiently detailed")
        elif decision == "reject":
            reasons.append("model pattern leaned reject; verify manually")
        else:
            reasons.append("mixed signals require manual review")

    if decision == "review" and confidence < 0.55 and "mixed signals require manual review" not in reasons:
        reasons.append("model confidence is moderate")

    return reasons[:4]
