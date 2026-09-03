"""The import contract of the ``inference_clients`` package (#293).

``inference_clients`` was a single module until the split, and every caller
still imports from the package root. These tests pin that surface so a later
pass that moves a function between family modules cannot quietly drop a name
that ``tasks.py`` or a service imports -- the failure would otherwise only
show up when the worker picks up a job.
"""

from __future__ import annotations

import ast
import importlib
from pathlib import Path

import pytest

import app.inference_clients as inference_clients

APP_DIR = Path(__file__).resolve().parents[1] / "app"

FAMILY_MODULES = ("comparison", "localize", "streaming", "text", "volume")


def test_every_exported_name_resolves() -> None:
    """``__all__`` is the documented surface; nothing on it may be missing."""
    missing = [name for name in inference_clients.__all__ if not hasattr(inference_clients, name)]
    assert missing == []


def test_exported_names_are_sorted_and_unique() -> None:
    assert inference_clients.__all__ == sorted(set(inference_clients.__all__))


@pytest.mark.parametrize("module_name", FAMILY_MODULES)
def test_family_modules_are_importable(module_name: str) -> None:
    importlib.import_module(f"app.inference_clients.{module_name}")


def _names_imported_from_inference_clients(source: Path) -> set[str]:
    """Collect the names a module imports from ``inference_clients``."""
    tree = ast.parse(source.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            # Relative imports inside `app`: `.inference_clients`, `..inference_clients`.
            if node.module.split(".")[-1] == "inference_clients":
                names.update(alias.name for alias in node.names)
    return names


def test_real_callers_only_import_exported_names() -> None:
    """Every in-repo import from the package root is covered by ``__all__``.

    This is the half that catches a regression: a name can be re-exported and
    unused, but a name a caller imports and the package does not export is a
    crash at worker start-up.
    """
    exported = set(inference_clients.__all__)
    unexported: dict[str, set[str]] = {}
    for source in APP_DIR.rglob("*.py"):
        if source.is_relative_to(APP_DIR / "inference_clients"):
            continue
        imported = _names_imported_from_inference_clients(source)
        if imported - exported:
            unexported[str(source.relative_to(APP_DIR))] = imported - exported

    assert unexported == {}


def test_the_split_actually_found_callers() -> None:
    """Guard the guard: the AST scan above must not silently match nothing."""
    callers = {
        source.relative_to(APP_DIR).as_posix()
        for source in APP_DIR.rglob("*.py")
        if not source.is_relative_to(APP_DIR / "inference_clients")
        and _names_imported_from_inference_clients(source)
    }
    assert "tasks.py" in callers
    assert "services/impression_service.py" in callers
