"""Tests for queue robustness: RQ retry/dead-letter routing and idempotent enqueue.

See issue #104. The RQ worker itself never runs in this test suite (no real
worker process, no real Redis - see conftest.py's fakeredis patch), so retry
behaviour is exercised by calling the tasks' failure-handling helpers
directly, with `app.tasks.get_current_job` monkeypatched to simulate the
in-progress/retries-remaining state a real worker would provide.
"""

from __future__ import annotations

from dataclasses import dataclass

from rq.job import Job

from app.models import InferenceJob
from app.queue import get_dead_letter_queue, get_queue_name, get_redis


@dataclass
class _FakeJob:
    retries_left: int | None


def _seed_inference_job(db, *, job_id: str, status: str = "started", report_id=None, study_id=None):
    from app.utils.time import utc_now

    job = InferenceJob(
        id=job_id,
        report_id=report_id,
        study_id=study_id,
        status=status,
        model_version="mock-medgemma-0.1",
        queued_at=utc_now(),
    )
    db.add(job)
    db.commit()
    return job


def test_handle_inference_failure_final_attempt_marks_failed_and_dead_letters(db, monkeypatch):
    from app import tasks

    monkeypatch.setattr(tasks, "get_current_job", lambda: None)

    job_id = "job-final-failure"
    _seed_inference_job(db, job_id=job_id)

    tasks._handle_inference_failure(
        db,
        task_fn=tasks.run_inference_job,
        payload={"job_id": job_id},
        job_id=job_id,
        exc=RuntimeError("boom"),
        report_id=None,
        study_id=None,
        requested_by="tester",
        failed_event_type="inference_failed",
        failed_metadata={},
    )

    refreshed = db.get(InferenceJob, job_id)
    assert refreshed.status == "failed"
    assert "boom" in refreshed.error_message

    dlq = get_dead_letter_queue(get_queue_name())
    assert dlq.count == 1
    dlq_job = Job.fetch(f"dead-letter-{job_id}", connection=get_redis())
    assert dlq_job.args[0] == {"job_id": job_id}


def test_handle_inference_failure_retries_left_resets_to_queued_without_dead_letter(
    db, monkeypatch
):
    from app import tasks

    monkeypatch.setattr(tasks, "get_current_job", lambda: _FakeJob(retries_left=2))

    job_id = "job-will-retry"
    _seed_inference_job(db, job_id=job_id)

    tasks._handle_inference_failure(
        db,
        task_fn=tasks.run_inference_job,
        payload={"job_id": job_id},
        job_id=job_id,
        exc=RuntimeError("transient"),
        report_id=None,
        study_id=None,
        requested_by="tester",
        failed_event_type="inference_failed",
        failed_metadata={},
    )

    refreshed = db.get(InferenceJob, job_id)
    assert refreshed.status == "queued"

    dlq = get_dead_letter_queue(get_queue_name())
    assert dlq.count == 0


def test_retries_remaining_none_outside_worker_context():
    from app.tasks import _retries_remaining

    assert _retries_remaining() is None


def test_enqueue_configures_retry_policy(client, sample_report):
    response = client.post(
        "/api/v1/inference/queue",
        json={
            "report_id": sample_report["id"],
            "study_id": sample_report["study_id"],
            "findings_text": "Some findings",
        },
    )
    assert response.status_code == 200
    job_id = response.json()["job_id"]

    rq_job = Job.fetch(job_id, connection=get_redis())
    assert rq_job.retries_left == 3
    assert rq_job.retry_intervals == [10, 30, 60]


def test_duplicate_inference_request_dedupes_onto_in_flight_job(client, sample_report):
    payload = {
        "report_id": sample_report["id"],
        "study_id": sample_report["study_id"],
        "findings_text": "Identical findings text",
    }

    first = client.post("/api/v1/inference/queue", json=payload)
    assert first.status_code == 200
    first_job_id = first.json()["job_id"]

    second = client.post("/api/v1/inference/queue", json=payload)
    assert second.status_code == 200
    assert second.json()["job_id"] == first_job_id

    from sqlalchemy.orm import sessionmaker

    from app.db import engine

    session = sessionmaker(bind=engine)()
    try:
        rows = (
            session.query(InferenceJob).filter(InferenceJob.report_id == sample_report["id"]).all()
        )
        assert len(rows) == 1
    finally:
        session.close()


def test_dead_letter_queue_count_surfaced_in_metrics(client):
    from app import tasks

    job_id = "job-for-metrics"
    tasks._route_to_dead_letter(tasks.run_inference_job, {"job_id": job_id}, job_id)

    response = client.get("/api/v1/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "dead_letter_queue_counts" in data
    counts = data["dead_letter_queue_counts"]
    assert list(counts.values())[0] == 1


def test_segmentation_enqueue_configures_retry_policy(client):
    response = client.post(
        "/api/v1/segmentation/jobs",
        json={"study_uid": "study-1", "series_uid": "series-1", "preset": "bone"},
    )
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    rq_job = Job.fetch(job_id, connection=get_redis())
    assert rq_job.retries_left == 3
    assert rq_job.retry_intervals == [10, 30, 60]


def test_handle_segmentation_failure_final_attempt_marks_failed_and_dead_letters(db, monkeypatch):
    from app import tasks
    from app.models import SegmentationJob
    from app.utils.time import utc_now

    monkeypatch.setattr(tasks, "get_current_job", lambda: None)

    job_id = "seg-job-final-failure"
    db.add(
        SegmentationJob(
            id=job_id,
            study_uid="study-1",
            series_uid="series-1",
            preset="bone",
            status="started",
            progress=0.0,
            created_by="tester",
            created_at=utc_now(),
            updated_at=utc_now(),
            data_dir="/tmp/seg",
        )
    )
    db.commit()

    tasks._handle_segmentation_failure(
        db,
        payload={"job_id": job_id},
        job_id=job_id,
        exc=RuntimeError("segmenter unreachable"),
        study_uid="study-1",
        series_uid="series-1",
        preset="bone",
        requested_by="tester",
    )

    refreshed = db.get(SegmentationJob, job_id)
    assert refreshed.status == "failed"

    dlq = get_dead_letter_queue(get_queue_name())
    assert dlq.count == 1


def test_handle_segmentation_failure_retries_left_resets_to_queued(db, monkeypatch):
    from app import tasks
    from app.models import SegmentationJob
    from app.utils.time import utc_now

    monkeypatch.setattr(tasks, "get_current_job", lambda: _FakeJob(retries_left=1))

    job_id = "seg-job-will-retry"
    db.add(
        SegmentationJob(
            id=job_id,
            study_uid="study-1",
            series_uid="series-1",
            preset="bone",
            status="started",
            progress=0.0,
            created_by="tester",
            created_at=utc_now(),
            updated_at=utc_now(),
            data_dir="/tmp/seg",
        )
    )
    db.commit()

    tasks._handle_segmentation_failure(
        db,
        payload={"job_id": job_id},
        job_id=job_id,
        exc=RuntimeError("transient"),
        study_uid="study-1",
        series_uid="series-1",
        preset="bone",
        requested_by="tester",
    )

    refreshed = db.get(SegmentationJob, job_id)
    assert refreshed.status == "queued"

    dlq = get_dead_letter_queue(get_queue_name())
    assert dlq.count == 0
