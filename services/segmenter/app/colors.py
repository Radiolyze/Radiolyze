from __future__ import annotations

from .labels import ColorRGB

# Curated TotalSegmentator label → RGB(0..1) palette. We hand-pick colors for
# the high-traffic organs and fall back to category heuristics for the long
# tail of bones / muscles. The exact RGB values are not anatomically
# meaningful — they only need to be visually distinct so the radiologist
# can tell ribs apart from organs at a glance.

_BONE = (0.93, 0.87, 0.74)
_MUSCLE = (0.78, 0.36, 0.32)
_VESSEL_ARTERY = (0.83, 0.18, 0.18)
_VESSEL_VEIN = (0.20, 0.34, 0.66)
_LUNG = (0.62, 0.78, 0.85)
_HEART = (0.84, 0.27, 0.29)
_LIVER = (0.69, 0.41, 0.34)
_SPLEEN = (0.55, 0.27, 0.30)
_KIDNEY = (0.78, 0.51, 0.36)
_BOWEL = (0.86, 0.71, 0.48)
_BRAIN = (0.92, 0.85, 0.79)
_BLADDER = (0.95, 0.86, 0.30)

_KNOWN: dict[str, ColorRGB] = {
    # Solid organs
    "spleen": _SPLEEN,
    "kidney_right": _KIDNEY,
    "kidney_left": _KIDNEY,
    "gallbladder": (0.45, 0.60, 0.34),
    "liver": _LIVER,
    "stomach": (0.85, 0.55, 0.34),
    "pancreas": (0.96, 0.79, 0.42),
    "adrenal_gland_right": (0.74, 0.54, 0.30),
    "adrenal_gland_left": (0.74, 0.54, 0.30),
    "duodenum": _BOWEL,
    "small_bowel": _BOWEL,
    "colon": (0.82, 0.62, 0.36),
    "esophagus": (0.74, 0.50, 0.42),
    "trachea": (0.62, 0.78, 0.85),
    "urinary_bladder": _BLADDER,
    "prostate": (0.88, 0.62, 0.55),
    "thyroid_gland": (0.97, 0.60, 0.34),
    "spinal_cord": (0.96, 0.92, 0.40),
    "brain": _BRAIN,
    "skull": _BONE,
    "face": (0.92, 0.80, 0.74),
    # Lungs & airways
    "lung_upper_lobe_left": _LUNG,
    "lung_lower_lobe_left": (0.55, 0.70, 0.82),
    "lung_upper_lobe_right": _LUNG,
    "lung_middle_lobe_right": (0.50, 0.65, 0.80),
    "lung_lower_lobe_right": (0.55, 0.70, 0.82),
    # Heart & great vessels
    "heart": _HEART,
    "heart_myocardium": _HEART,
    "heart_atrium_left": (0.74, 0.18, 0.20),
    "heart_atrium_right": (0.74, 0.18, 0.40),
    "heart_ventricle_left": (0.84, 0.25, 0.26),
    "heart_ventricle_right": (0.84, 0.25, 0.46),
    "aorta": _VESSEL_ARTERY,
    "pulmonary_artery": (0.72, 0.21, 0.36),
    "pulmonary_vein": _VESSEL_VEIN,
    "inferior_vena_cava": _VESSEL_VEIN,
    "portal_vein_and_splenic_vein": (0.30, 0.42, 0.70),
    "iliac_artery_left": _VESSEL_ARTERY,
    "iliac_artery_right": _VESSEL_ARTERY,
    "iliac_vena_left": _VESSEL_VEIN,
    "iliac_vena_right": _VESSEL_VEIN,
    # Skeleton
    "sacrum": _BONE,
    "humerus_left": _BONE,
    "humerus_right": _BONE,
    "scapula_left": _BONE,
    "scapula_right": _BONE,
    "clavicula_left": _BONE,
    "clavicula_right": _BONE,
    "femur_left": _BONE,
    "femur_right": _BONE,
    "hip_left": _BONE,
    "hip_right": _BONE,
    "sternum": _BONE,
    # Pelvic / paraspinal muscles
    "gluteus_maximus_left": _MUSCLE,
    "gluteus_maximus_right": _MUSCLE,
    "gluteus_medius_left": (0.71, 0.32, 0.30),
    "gluteus_medius_right": (0.71, 0.32, 0.30),
    "gluteus_minimus_left": (0.65, 0.28, 0.28),
    "gluteus_minimus_right": (0.65, 0.28, 0.28),
    "autochthon_left": _MUSCLE,
    "autochthon_right": _MUSCLE,
    "iliopsoas_left": _MUSCLE,
    "iliopsoas_right": _MUSCLE,
}


def color_for_label(name: str) -> ColorRGB:
    """Return an RGB triple for a TotalSegmentator label name.

    Falls through curated names → category heuristics → neutral default.
    """
    if name in _KNOWN:
        return _KNOWN[name]
    lower = name.lower()
    if lower.startswith("rib_"):
        return _BONE
    if lower.startswith("vertebrae_"):
        return _BONE
    if lower.startswith("rib") or lower.startswith("costal"):
        return _BONE
    if "muscle" in lower or "iliopsoas" in lower or "glute" in lower:
        return _MUSCLE
    if "vessel" in lower or "artery" in lower:
        return _VESSEL_ARTERY
    if "vein" in lower or "vena" in lower:
        return _VESSEL_VEIN
    if "lung" in lower or "trachea" in lower:
        return _LUNG
    if "heart" in lower:
        return _HEART
    if "brain" in lower:
        return _BRAIN
    if "kidney" in lower:
        return _KIDNEY
    if "bowel" in lower or "colon" in lower or "duodenum" in lower:
        return _BOWEL
    return (0.78, 0.78, 0.78)
