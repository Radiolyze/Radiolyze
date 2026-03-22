"""Tests for input sanitization utilities."""

from __future__ import annotations

from app.utils.sanitize import sanitize_medical_text


class TestSanitizeMedicalText:
    def test_none_returns_none(self):
        assert sanitize_medical_text(None) is None

    def test_plain_text_unchanged(self):
        text = "Normalbefund. Lunge beidseits belüftet."
        assert sanitize_medical_text(text) == text

    def test_strips_html_tags(self):
        text = "<script>alert('xss')</script>Befund normal"
        result = sanitize_medical_text(text)
        assert "<script>" not in result
        assert "Befund normal" in result

    def test_strips_nested_html(self):
        text = "<div><b>Bold</b> <i>Italic</i></div>"
        result = sanitize_medical_text(text)
        assert "<" not in result
        assert "Bold" in result
        assert "Italic" in result

    def test_removes_null_bytes(self):
        text = "Normal\x00befund"
        result = sanitize_medical_text(text)
        assert "\x00" not in result
        assert "Normalbefund" in result

    def test_removes_control_characters(self):
        text = "Normal\x01\x02\x03befund"
        result = sanitize_medical_text(text)
        assert "Normalbefund" in result

    def test_preserves_newlines_and_tabs(self):
        text = "Befund:\n\tLunge normal\n\tHerz normal"
        result = sanitize_medical_text(text)
        assert "\n" in result
        assert "\t" in result

    def test_unicode_normalization(self):
        # ü as u + combining diaeresis (NFD) -> ü (NFC)
        text = "Lu\u0308ftung"
        result = sanitize_medical_text(text)
        assert result == "Lüftung"

    def test_truncates_to_max_length(self):
        text = "a" * 100
        result = sanitize_medical_text(text, max_length=50)
        assert len(result) == 50

    def test_medical_abbreviations_preserved(self):
        text = "CT: 5mm Nodule in LUL. MR: T1/T2-hyperintens. <3cm"
        result = sanitize_medical_text(text)
        # <3cm contains < which looks like HTML but should be kept partly
        # The < will be stripped as part of a tag only if it has >
        assert "CT:" in result
        assert "MR:" in result

    def test_german_umlauts_preserved(self):
        text = "Größe des Ösophagus. Übersicht der Nüchternaufnahme."
        result = sanitize_medical_text(text)
        assert "Größe" in result
        assert "Ösophagus" in result
        assert "Übersicht" in result

    def test_empty_string(self):
        assert sanitize_medical_text("") == ""
