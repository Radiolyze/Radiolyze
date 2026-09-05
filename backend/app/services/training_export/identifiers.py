"""Whether an export carries the real DICOM identifiers, or pseudonyms.

``anonymize=True`` has to reach every place a study, series or instance id is
written: the frame key, the ZIP member name, the image path, the WADO URL, the
manifest and each format's own id fields. Those are not independent -- the key
*is* the file name the dataset points at -- so if any one of them is mapped
differently from the rest, the export stops resolving its own images. That is
why the decision is made once, here, and handed to the builders as something
they apply *while* they build, rather than rewritten into finished output.

The mapping deliberately covers only the three frame identifiers. The rest of
the de-identification -- DICOM attributes under ``metadata``, the names of the
people who drew and verified an annotation -- stays in ``app.anonymize``, which
the formats that carry those fields call in addition.
"""

from __future__ import annotations

from dataclasses import dataclass

from ...anonymize import pseudonymize


@dataclass(frozen=True)
class Identifiers:
    """Maps a study/series/instance id to the value the export carries for it.

    Callable, so a builder applies it as ``ids(ann.study_id)`` wherever an
    identifier reaches the output, and never has to ask which mode it is in.
    ``anonymize`` is readable for the one decision that is not about ids: a
    format carrying DICOM metadata or actor names scrubs those as well.
    """

    anonymize: bool

    def __call__(self, value: str) -> str:
        return pseudonymize(value) if self.anonymize else value


#: The export carries the real identifiers. Also the default everywhere a frame
#: key is built outside an export -- notably the manifest preview, which exists
#: to be fetched against and therefore needs the ids that address real frames.
IDENTIFIED = Identifiers(anonymize=False)

#: The export carries pseudonyms.
PSEUDONYMIZED = Identifiers(anonymize=True)


def id_map(anonymize: bool) -> Identifiers:
    """The mapping an export with this ``anonymize`` flag writes its ids through."""
    return PSEUDONYMIZED if anonymize else IDENTIFIED
