"""Tests for P0.B volume inference + P1.A comparison + P1.B modality-aware localize."""

from __future__ import annotations

from unittest.mock import patch

import pytest


def _vllm_chat_response(content: str) -> dict:
    return {
        "choices": [
            {
                "message": {"content": content},
                "finish_reason": "stop",
            }
        ]
    }


def test_volume_endpoint_rejects_missing_uids(client) -> None:
    response = client.post(
        "/api/v1/inference/volume",
        json={"study_uid": "", "series_uid": "1.2.3"},
    )
    assert response.status_code == 422


def test_volume_endpoint_queues_job_with_mock_provider(client) -> None:
    response = client.post(
        "/api/v1/inference/volume",
        json={
            "study_uid": "1.2.3",
            "series_uid": "1.2.3.4",
            "max_slices": 32,
            "window_preset": "lung",
            "strategy": "uniform",
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] in {"queued", "started", "deferred", "scheduled"}
    assert payload["job_id"]


def test_comparison_endpoint_queues_job(client) -> None:
    response = client.post(
        "/api/v1/inference/comparison",
        json={
            "study_uid": "1.2.3",
            "series_uid": "1.2.3.4",
            "prior_study_uid": "1.2.4",
            "prior_series_uid": "1.2.4.5",
            "time_delta_days": 90,
            "modality": "CT",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["job_id"]


def test_localize_rejects_non_cxr_modality(client) -> None:
    response = client.post(
        "/api/v1/inference/localize",
        json={
            "image_ref": {
                "study_id": "S",
                "series_id": "SE",
                "instance_id": "I",
                "frame_index": 0,
                "stack_index": 0,
                "wado_url": "http://orthanc/foo",
                "series_modality": "CT",
            },
            "mode": "cxr_finding",
        },
    )
    assert response.status_code == 422
    assert "chest" in response.json()["detail"].lower()


def test_localize_accepts_cxr_modality(client) -> None:
    response = client.post(
        "/api/v1/inference/localize",
        json={
            "image_ref": {
                "study_id": "S",
                "series_id": "SE",
                "instance_id": "I",
                "frame_index": 0,
                "stack_index": 0,
                "wado_url": "http://orthanc/foo",
                "series_modality": "CR",
            },
            "mode": "cxr_anatomy",
        },
    )
    assert response.status_code == 200, response.text


def test_generate_localize_findings_raises_on_unsupported_modality() -> None:
    from app.inference_clients import (
        UnsupportedModalityError,
        generate_localize_findings,
    )

    with pytest.raises(UnsupportedModalityError):
        generate_localize_findings(
            {
                "wado_url": "http://orthanc/foo",
                "series_modality": "CT",
            }
        )


def test_generate_volume_summary_uses_preprocess(monkeypatch) -> None:
    """When VLLM_ENABLED, the volume summary calls the segmenter then vLLM."""
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    fake_preprocess = {
        "modality": "CT",
        "window_preset": "mediastinum",
        "strategy": "uniform",
        "selected_count": 4,
        "total_count": 100,
        "resize": 896,
        "pixel_spacing": [0.7, 0.7],
        "slice_thickness": 1.5,
        "slices": [{"index": i, "data_url": f"data:image/png;base64,FAKE{i}"} for i in range(1, 5)],
    }

    captured: dict = {}

    def fake_chat(
        prompt,
        *,
        model_name,
        system_prompt,
        image_urls=None,
        image_paths=None,
        guided_json_schema=None,
    ):
        captured["prompt"] = prompt
        captured["image_urls"] = image_urls
        captured["model_name"] = model_name
        return '{"summary":"Mediastinal lymphadenopathy.","evidence_indices":[1,3]}'

    with (
        patch("app.segmentation_client.preprocess_for_medgemma", return_value=fake_preprocess),
        patch("app.vllm_client._vllm_chat_completion", side_effect=fake_chat),
    ):
        from app.inference_clients import generate_volume_inference_summary

        text, confidence, model, metadata = generate_volume_inference_summary(
            study_uid="S",
            series_uid="SE",
            findings_text="suspicious nodes",
        )

    assert text == "Mediastinal lymphadenopathy."
    assert metadata["volume_preprocess"]["modality"] == "CT"
    assert metadata["volume_preprocess"]["selected_count"] == 4
    assert metadata["evidence_indices"] == [1, 3]
    assert captured["image_urls"] and captured["image_urls"][0].startswith("data:image/png;base64,")
    assert "axial slices" in captured["prompt"]


def test_generate_comparison_text_emits_structured_output(monkeypatch) -> None:
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    def fake_preprocess(*, study_uid, series_uid, **_kwargs):
        return {
            "modality": "CT",
            "window_preset": "mediastinum",
            "strategy": "uniform",
            "selected_count": 2,
            "total_count": 50,
            "resize": 896,
            "slices": [
                {"index": 1, "data_url": "data:image/png;base64,A", "z_position": 10.0},
                {"index": 2, "data_url": "data:image/png;base64,B", "z_position": 12.0},
            ],
        }

    fake_response = (
        '{"summary_change":"New 6mm nodule in RUL.",'
        '"changes":[{"finding":"RUL nodule","status":"new",'
        '"evidence_indices_current":[1],"evidence_indices_prior":[3],'
        '"quantitative_change":"absent → 6mm"}],'
        '"overall_trend":"worsened","confidence":"medium"}'
    )

    with (
        patch("app.segmentation_client.preprocess_for_medgemma", side_effect=fake_preprocess),
        patch("app.vllm_client._vllm_chat_completion", return_value=fake_response),
    ):
        from app.inference_clients import generate_comparison_text

        summary, _confidence, _model, metadata = generate_comparison_text(
            current_study_uid="S1",
            current_series_uid="SE1",
            prior_study_uid="S0",
            prior_series_uid="SE0",
            time_delta_days=42,
        )

    assert summary == "New 6mm nodule in RUL."
    assert metadata["comparison"]["time_delta_days"] == 42
    assert metadata["json_schema_valid"] is True
    assert metadata["comparison_output"]["overall_trend"] == "worsened"
    assert metadata["comparison_output"]["changes"][0]["status"] == "new"


def test_schema_endpoint_includes_comparison(client) -> None:
    response = client.get("/api/v1/inference/schemas")
    assert response.status_code == 200
    payload = response.json()
    assert "comparison_output" in payload["schemas"]


@pytest.mark.parametrize("missing", ["study_uid", "series_uid"])
def test_volume_job_rejects_a_payload_without_uids(missing: str) -> None:
    """A UID the job cannot run without fails here, not four layers down.

    ``VolumeInferenceRequest`` declares both UIDs required, but the worker receives a
    plain dict. A ``None`` used to reach ``preprocess_for_medgemma``, whose broad
    ``except`` turned the segmenter error into a mock summary stored as a successful
    inference.
    """
    from app.tasks import run_volume_inference_job

    payload = {"study_uid": "1.2.3", "series_uid": "1.2.3.4"}
    del payload[missing]

    with pytest.raises(ValueError, match=missing):
        run_volume_inference_job(payload)


@pytest.mark.parametrize(
    "missing",
    ["study_uid", "series_uid", "prior_study_uid", "prior_series_uid"],
)
def test_comparison_job_rejects_a_payload_without_uids(missing: str) -> None:
    from app.tasks import run_comparison_inference_job

    payload = {
        "study_uid": "1.2.3",
        "series_uid": "1.2.3.4",
        "prior_study_uid": "1.2.2",
        "prior_series_uid": "1.2.2.4",
    }
    del payload[missing]

    with pytest.raises(ValueError, match=missing):
        run_comparison_inference_job(payload)


# --- Finding categories (#298) -------------------------------------------------
#
# The overlay used to derive the colour of a box from a keyword list over the
# free-text label. The category now comes from the model with the box, so these
# cover the two directions that list could not: a category the schema does not
# know, and a finding the model left uncategorized.


def test_finding_box_keeps_the_box_when_the_category_is_unknown() -> None:
    from app.ai_schemas import LocalizeOutput

    output = LocalizeOutput.model_validate(
        {
            "findings": [
                {"box_2d": [1, 2, 3, 4], "label": "Consolidation", "category": "PATHOLOGICAL"},
                {"box_2d": [5, 6, 7, 8], "label": "Nodule", "category": "suspicious"},
                {"box_2d": [9, 10, 11, 12], "label": "Right lung"},
            ]
        }
    )

    # Case-folded, unknown dropped to None -- and no finding lost: a category
    # outside the set costs the hint, not the box.
    assert [f.category for f in output.findings] == ["pathological", None, None]
    assert len(output.findings) == 3


def test_generate_localize_findings_passes_the_category_through(monkeypatch) -> None:
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    response = (
        '{"findings":['
        '{"box_2d":[10,20,30,40],"label":"Consolidation",'
        '"category":"pathological","confidence":0.8},'
        '{"box_2d":[50,60,70,80],"label":"Pneumothorax","confidence":0.6}]}'
    )

    with patch("app.vllm_client._vllm_chat_completion", return_value=response):
        from app.inference_clients import generate_localize_findings

        findings, _model, metadata = generate_localize_findings(
            {"wado_url": "http://orthanc/foo", "series_modality": "CR"}
        )

    assert metadata["json_schema_valid"] is True
    assert [f["category"] for f in findings] == ["pathological", None]


def test_localize_anatomy_mode_defaults_the_category(monkeypatch) -> None:
    """Every box in anatomy mode is an anatomical region by construction."""
    monkeypatch.setenv("VLLM_ENABLED", "true")
    monkeypatch.setenv("VLLM_FALLBACK_TO_MOCK", "false")

    response = '{"findings":[{"box_2d":[10,20,30,40],"label":"Right lung","confidence":0.9}]}'

    with patch("app.vllm_client._vllm_chat_completion", return_value=response):
        from app.inference_clients import generate_localize_findings

        findings, _model, _metadata = generate_localize_findings(
            {"wado_url": "http://orthanc/foo", "series_modality": "DX"},
            mode="cxr_anatomy",
        )

    assert [f["category"] for f in findings] == ["anatomical"]
