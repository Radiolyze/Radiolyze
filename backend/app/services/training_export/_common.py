"""Pieces every export format shares.

Kept separate from the format modules so that none of them has to import
another: the three of them are siblings, not a chain.
"""

from __future__ import annotations

from typing import Literal

ExportFormat = Literal["coco", "huggingface", "radiolyze"]

#: Appended to a format's README when the archive carries the rendered frames.
#: All three formats say the same thing here, so they say it once.
DATA_CAPTURE_NOTE = """

## Data Capture
Dieses Exportpaket enthaelt gerenderte PNGs in `images/` und ein
`images/manifest.json` mit Metadaten/Hashes.
"""
