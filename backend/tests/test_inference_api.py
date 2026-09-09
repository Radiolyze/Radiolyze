"""HTTP-surface characterisation for the inference routes.

Written against the pre-split ``app/api/inference.py`` and kept unchanged
across the move to ``app/services/inference_queue/`` (#293), so it pins the
behaviour the refactor had to preserve rather than the shape it produced.

The four queue routes share one skeleton, so the interesting cases are the
places where they *differ* from it — the guards that reject a request before
anything is enqueued, the per-route audit event types, and the status route's
two pieces of logic.
"""

from __future__ import annotations

import os
from datetime import timedelta
from unittest.mock import patch

import pytest

from app.models import AuditEvent, InferenceJob
from app.utils.time import utc_now


def image_ref(**overrides: object) -> dict[str, object]:
    """A complete ImageRef; every required field must be present or the route
    fails validation before it reaches the logic under test."""
    return {
        "study_id": "S",
        "series_id": "SE",
        "instance_id": "I",
        "frame_index": 0,
        "stack_index": 0,
        "wado_url": "http://orthanc/foo",
        **overrides,
    }


# The four queue routes and a minimal body that reaches the report lookup.
QUEUE_ROUTES = [
    ("/api/v1/inference/queue", {"findings_text": "Findings."}),
    ("/api/v1/inference/localize", {"image_ref": image_ref()}),
    ("/api/v1/inference/volume", {"study_uid": "1.2.3", "series_uid": "1.2.4"}),
    (
        "/api/v1/inference/comparison",
        {
            "study_uid": "1.2.3",
            "series_uid": "1.2.4",
            "prior_study_uid": "1.2.1",
            "prior_series_uid": "1.2.2",
        },
    ),
]
ROUTE_IDS = ["queue", "localize", "volume", "comparison"]


# ---------------------------------------------------------------------------
# The report lookup, shared by all four queue routes
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(("path", "body"), QUEUE_ROUTES, ids=ROUTE_IDS)
def test_queue_routes_404_on_an_unknown_report(client, path, body) -> None:
    """A report_id that does not resolve is a 404 before anything is enqueued."""
    response = client.post(path, json={**body, "report_id": "no-such-report"})
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "Report not found"


@pytest.mark.parametrize(("path", "body"), QUEUE_ROUTES, ids=ROUTE_IDS)
def test_queue_routes_enqueue_nothing_when_the_report_is_missing(client, db, path, body) -> None:
    """The 404 must be a clean reject: no job row left behind."""
    client.post(path, json={**body, "report_id": "no-such-report"})
    db.expire_all()
    assert db.query(InferenceJob).count() == 0


@pytest.mark.parametrize(("path", "body"), QUEUE_ROUTES, ids=ROUTE_IDS)
def test_queue_routes_work_without_a_report(client, path, body) -> None:
    """report_id is optional on all four routes; study_id then stands alone."""
    response = client.post(path, json={**body, "study_id": "study-standalone"})
    assert response.status_code == 200, response.text
    assert response.json()["study_id"] == "study-standalone"


# ---------------------------------------------------------------------------
# /queue: the "at least one input" guard and the image-path allow-list
# ---------------------------------------------------------------------------
def test_queue_requires_at_least_one_input(client) -> None:
    response = client.post("/api/v1/inference/queue", json={"study_id": "study-001"})
    assert response.status_code == 422
    assert "At least one of" in response.json()["detail"]


def test_queue_rejects_an_image_path_outside_the_allowed_directories(client) -> None:
    """Path-traversal guard: a 400 with the offending path named."""
    response = client.post(
        "/api/v1/inference/queue",
        json={"study_id": "study-001", "image_paths": ["/etc/passwd"]},
    )
    assert response.status_code == 400
    assert "not in allowed directory" in response.json()["detail"]


def test_queue_rejects_a_traversal_escape_from_an_allowed_directory(client) -> None:
    """``..`` segments are resolved before the prefix check, not after — the
    string starts with an allowed prefix but does not stay inside it."""
    response = client.post(
        "/api/v1/inference/queue",
        json={"study_id": "study-001", "image_paths": ["/tmp/dicom/../../etc/passwd"]},
    )
    assert response.status_code == 400


def test_queue_accepts_a_sibling_directory_sharing_a_prefix(client) -> None:
    """Pins a defect, not a requirement — see #332.

    The allow-list is a bare string-prefix test, so a sibling directory whose
    name merely *starts with* an allowed one passes. Recorded here rather than
    fixed so the #293 split stays behaviour-preserving; when #332 lands this
    assertion flips to 400.
    """
    response = client.post(
        "/api/v1/inference/queue",
        json={"study_id": "study-001", "image_paths": ["/tmp/dicom-attacker/secret.png"]},
    )
    assert response.status_code == 200, response.text


def test_queue_accepts_an_image_path_inside_an_allowed_directory(client, db) -> None:
    """The guard must not be over-broad: an allowed path still queues, and is
    counted as a path source rather than a URL."""
    response = client.post(
        "/api/v1/inference/queue",
        json={"study_id": "study-001", "image_paths": ["/tmp/dicom/frame0.png"]},
    )
    assert response.status_code == 200, response.text

    db.expire_all()
    job = db.get(InferenceJob, response.json()["job_id"])
    assert job is not None
    assert job.metadata_json["image_count"] == 1
    assert job.metadata_json["image_sources"] == ["path"]


def test_queue_hashes_the_resolved_image_path_not_the_raw_one(client) -> None:
    """``_validate_image_paths`` returns *resolved* paths, and those are what
    feed the input hash. Two spellings of one file are therefore one request:
    the second dedupes onto the first in-flight job instead of paying for a
    second inference."""
    first = client.post(
        "/api/v1/inference/queue",
        json={"study_id": "study-dedup", "image_paths": ["/tmp/dicom/frame0.png"]},
    )
    second = client.post(
        "/api/v1/inference/queue",
        json={"study_id": "study-dedup", "image_paths": ["/tmp/dicom/./sub/../frame0.png"]},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["job_id"] == first.json()["job_id"]


# ---------------------------------------------------------------------------
# /localize: the modality guard writes an audit event *and commits* before 422
# ---------------------------------------------------------------------------
def test_localize_modality_rejection_is_audited(client, db) -> None:
    """The 422 is not silent — a rejected modality is committed to the audit
    log. A refactor that raised before the commit would lose the row while
    still returning the same status code."""
    response = client.post(
        "/api/v1/inference/localize",
        json={"study_id": "study-001", "image_ref": image_ref(series_modality="CT")},
    )
    assert response.status_code == 422

    db.expire_all()
    events = db.query(AuditEvent).filter_by(event_type="inference_localize_rejected_modality").all()
    assert len(events) == 1
    assert events[0].metadata_json["modality"] == "CT"
    assert events[0].metadata_json["mode"] == "cxr_finding"


def test_localize_allows_a_frame_with_no_declared_modality(client) -> None:
    """The guard only fires on a *known* non-CXR modality; an empty one passes."""
    response = client.post(
        "/api/v1/inference/localize",
        json={"study_id": "study-001", "image_ref": image_ref()},
    )
    assert response.status_code == 200, response.text


def test_localize_defaults_the_mode(client, db) -> None:
    response = client.post(
        "/api/v1/inference/localize",
        json={"study_id": "study-001", "image_ref": image_ref()},
    )
    assert response.status_code == 200, response.text

    db.expire_all()
    job = db.get(InferenceJob, response.json()["job_id"])
    assert job is not None
    assert job.metadata_json["job_type"] == "localize"


# ---------------------------------------------------------------------------
# Report-derived defaults, shared by the skeleton
# ---------------------------------------------------------------------------
def test_queue_inherits_study_and_findings_from_the_report(client, sample_report) -> None:
    """With only a report_id, study_id and findings_text come off the report —
    findings_text implicitly, since the request would otherwise be a 422."""
    response = client.post("/api/v1/inference/queue", json={"report_id": sample_report["id"]})
    assert response.status_code == 200, response.text
    assert response.json()["study_id"] == "study-001"


def test_queue_prefers_explicit_values_over_the_report(client, sample_report) -> None:
    response = client.post(
        "/api/v1/inference/queue",
        json={"report_id": sample_report["id"], "study_id": "study-override"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["study_id"] == "study-override"


def test_queue_defaults_requested_by_to_system(client, db, sample_report) -> None:
    response = client.post(
        "/api/v1/inference/queue",
        json={"report_id": sample_report["id"], "findings_text": "Findings."},
    )
    assert response.status_code == 200, response.text

    db.expire_all()
    job = db.get(InferenceJob, response.json()["job_id"])
    assert job is not None
    assert job.metadata_json["requested_by"] == "system"


@pytest.mark.parametrize(
    ("path", "body", "event_type"),
    [
        (*QUEUE_ROUTES[0], "inference_queued"),
        (*QUEUE_ROUTES[1], "inference_queued"),
        (*QUEUE_ROUTES[2], "inference_volume_queued"),
        (*QUEUE_ROUTES[3], "inference_comparison_queued"),
    ],
    ids=ROUTE_IDS,
)
def test_each_queue_route_writes_its_own_audit_event_type(
    client, db, path, body, event_type
) -> None:
    """The audit event type is per-route and is what the compliance export
    filters on; the shared skeleton must not collapse the four into one."""
    response = client.post(path, json={**body, "study_id": "study-001"})
    assert response.status_code == 200, response.text

    db.expire_all()
    events = db.query(AuditEvent).filter_by(event_type=event_type).all()
    assert len(events) == 1
    assert events[0].metadata_json["job_id"] == response.json()["job_id"]


# ---------------------------------------------------------------------------
# /status: the stuck-job transition and the metadata allow-list
# ---------------------------------------------------------------------------
def test_status_fails_a_job_that_outlived_the_timeout(client, db) -> None:
    """A queued job older than INFERENCE_JOB_TIMEOUT is flipped to failed on
    read, and the transition is persisted rather than only reported."""
    timeout = int(os.getenv("INFERENCE_JOB_TIMEOUT", "600"))
    db.add(
        InferenceJob(
            id="stale-job",
            status="queued",
            model_version="m1",
            queued_at=utc_now() - timedelta(seconds=timeout + 60),
        )
    )
    db.commit()

    response = client.get("/api/v1/inference/status/stale-job")
    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert f"timed out after {timeout}s" in response.json()["error"]

    db.expire_all()
    stored = db.get(InferenceJob, "stale-job")
    assert stored is not None
    assert stored.status == "failed"


def test_status_leaves_a_fresh_queued_job_alone(client, db) -> None:
    db.add(InferenceJob(id="fresh-job", status="queued", model_version="m1", queued_at=utc_now()))
    db.commit()

    assert client.get("/api/v1/inference/status/fresh-job").json()["status"] == "queued"


def test_status_filters_result_metadata_to_the_allow_list(client, db) -> None:
    """The stored job metadata is worker-controlled and holds request internals;
    only the declared keys reach the client. A leak here is a PHI question, not
    a formatting one."""
    db.add(
        InferenceJob(
            id="done-job",
            status="finished",
            model_version="m1",
            summary_text="Summary.",
            queued_at=utc_now(),
            completed_at=utc_now(),
            metadata_json={
                "schema_name": "impression",
                "provider": "mock",
                "prompt": {"system": "s", "user": "u"},
                "patient_name": "Doe^Jane",
                "internal_note": "not for clients",
            },
        )
    )
    db.commit()

    metadata = client.get("/api/v1/inference/status/done-job").json()["result"]["metadata"]
    assert metadata["schema_name"] == "impression"
    assert metadata["provider"] == "mock"
    assert metadata["prompt"] == {"system": "s", "user": "u"}
    assert "patient_name" not in metadata
    assert "internal_note" not in metadata


def test_status_returns_no_metadata_when_nothing_survives_the_filter(client, db) -> None:
    db.add(
        InferenceJob(
            id="bare-job",
            status="finished",
            model_version="m1",
            queued_at=utc_now(),
            completed_at=utc_now(),
            metadata_json={"patient_name": "Doe^Jane"},
        )
    )
    db.commit()

    assert client.get("/api/v1/inference/status/bare-job").json()["result"]["metadata"] is None


def test_status_surfaces_findings_and_evidence_from_the_job_metadata(client, db) -> None:
    """image_refs / evidence_indices / findings are returned at the top level of
    the result, bypassing the metadata allow-list."""
    db.add(
        InferenceJob(
            id="rich-job",
            status="finished",
            model_version="m1",
            queued_at=utc_now(),
            completed_at=utc_now(),
            metadata_json={
                "image_refs": [{"study_id": "1.2.3"}],
                "evidence_indices": [0],
                "findings": [{"label": "opacity"}],
            },
        )
    )
    db.commit()

    result = client.get("/api/v1/inference/status/rich-job").json()["result"]
    assert result["image_refs"] == [{"study_id": "1.2.3"}]
    assert result["evidence_indices"] == [0]
    assert result["findings"] == [{"label": "opacity"}]


def test_status_omits_the_result_until_the_job_is_finished(client, db) -> None:
    db.add(
        InferenceJob(
            id="running-job",
            status="started",
            model_version="m1",
            summary_text="partial",
            queued_at=utc_now(),
        )
    )
    db.commit()

    assert client.get("/api/v1/inference/status/running-job").json()["result"] is None


def test_status_404s_for_an_unknown_job(client) -> None:
    assert client.get("/api/v1/inference/status/nope").status_code == 404


# ---------------------------------------------------------------------------
# The auth dependency, which is easy to drop silently in a move
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(("path", "body"), QUEUE_ROUTES, ids=ROUTE_IDS)
def test_queue_routes_reject_unauthenticated_requests(client, path, body) -> None:
    """All four queue routes carry require_radiologist_or_admin."""
    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        assert client.post(path, json={**body, "study_id": "study-001"}).status_code == 401


def test_status_stays_reachable_without_a_role(client, db) -> None:
    """/status is deliberately ungated — the viewer polls it. Adding a guard
    here while moving code would break polling for every client."""
    db.add(InferenceJob(id="open-job", status="queued", model_version="m1", queued_at=utc_now()))
    db.commit()

    with patch.dict(os.environ, {"AUTH_REQUIRED": "true"}):
        assert client.get("/api/v1/inference/status/open-job").status_code == 200
