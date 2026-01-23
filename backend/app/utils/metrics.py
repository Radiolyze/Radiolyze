from __future__ import annotations

import os
from typing import Any

from ..models import InferenceJob, QACheckResult


def counts_to_dict(rows: list[tuple[str | None, int]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for key, count in rows:
        label = key or "unknown"
        result[label] = count
    return result


def get_threshold(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def calculate_median(values: list[float]) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    midpoint = len(sorted_values) // 2
    if len(sorted_values) % 2 == 1:
        return sorted_values[midpoint]
    return (sorted_values[midpoint - 1] + sorted_values[midpoint]) / 2


def summarize_inference_jobs(jobs: list[InferenceJob]) -> dict[str, Any]:
    total = len(jobs)
    status_counts: dict[str, int] = {}
    confidences: list[float] = []
    for job in jobs:
        status = job.status or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        if job.confidence is not None:
            confidences.append(float(job.confidence))

    average_confidence = sum(confidences) / len(confidences) if confidences else None
    failed_count = status_counts.get("failed", 0)
    failure_rate = failed_count / total if total else None

    return {
        "total": total,
        "status_counts": status_counts,
        "confidence_avg": average_confidence,
        "confidence_median": calculate_median(confidences),
        "failure_rate": failure_rate,
    }


def summarize_qa_results(results: list[QACheckResult]) -> dict[str, Any]:
    total = len(results)
    status_counts: dict[str, int] = {}
    quality_scores: list[float] = []
    for result in results:
        status = result.status or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        if result.quality_score is not None:
            quality_scores.append(float(result.quality_score))

    pass_count = status_counts.get("pass", 0)
    pass_rate = pass_count / total if total else None
    average_score = sum(quality_scores) / len(quality_scores) if quality_scores else None

    return {
        "total": total,
        "status_counts": status_counts,
        "pass_rate": pass_rate,
        "quality_score_avg": average_score,
    }


def compute_deltas(current: dict[str, Any], baseline: dict[str, Any], keys: list[str]) -> dict[str, float | None]:
    deltas: dict[str, float | None] = {}
    for key in keys:
        current_value = current.get(key)
        baseline_value = baseline.get(key)
        if current_value is None or baseline_value is None:
            deltas[key] = None
        else:
            deltas[key] = float(current_value) - float(baseline_value)
    return deltas
