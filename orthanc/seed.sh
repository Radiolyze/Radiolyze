#!/usr/bin/env sh
set -e

ORTHANC_URL="${ORTHANC_URL:-http://orthanc:8042}"
ORTHANC_USERNAME="${ORTHANC_USERNAME:-orthanc}"
ORTHANC_PASSWORD="${ORTHANC_PASSWORD:-orthanc}"
ORTHANC_SEED_ENABLED="${ORTHANC_SEED_ENABLED:-true}"
ORTHANC_SEED_MODE="${ORTHANC_SEED_MODE:-full}"

# Base URL for pydicom-data repository
PYDICOM_DATA_BASE="https://github.com/pydicom/pydicom-data/raw/master/data_store/data"

# Define test datasets by category
# MRI datasets
MRI_FILES="
emri_small.dcm
emri_small_RLE.dcm
emri_small_big_endian.dcm
emri_small_jpeg_2k_lossless.dcm
emri_small_jpeg_ls_lossless.dcm
MR-SIEMENS-DICOM-WithOverlays.dcm
MR2_J2KI.dcm
MR2_J2KR.dcm
MR2_UNCI.dcm
MR2_UNCR.dcm
"

# CT datasets
CT_FILES="
liver.dcm
liver_deflate.dcm
liver_expb.dcm
liver_j2k.dcm
liver_rle.dcm
liver_nonbyte_aligned.dcm
liver_nonbyte_aligned_deflate.dcm
liver_nonbyte_aligned_j2k.dcm
liver_nonbyte_aligned_rle.dcm
eCT_Supplemental.dcm
"

# Multi-frame datasets (series simulation)
MULTIFRAME_FILES="
OBXXXX1A.dcm
OBXXXX1A_2frame.dcm
OBXXXX1A_rle.dcm
OBXXXX1A_rle_2frame.dcm
OBXXXX1A_expb.dcm
OBXXXX1A_expb_2frame.dcm
SC_rgb_2frame.dcm
SC_rgb_16bit_2frame.dcm
SC_rgb_32bit_2frame.dcm
SC_rgb_expb_2frame.dcm
SC_rgb_expb_16bit_2frame.dcm
SC_rgb_expb_32bit_2frame.dcm
color3d_jpeg_baseline.dcm
"

# Ultrasound datasets
US_FILES="
US1_J2KI.dcm
US1_J2KR.dcm
US1_UNCI.dcm
US1_UNCR.dcm
gdcm-US-ALOKA-16.dcm
gdcm-US-ALOKA-16_big.dcm
"

# Radiography datasets
RG_FILES="
RG1_J2KI.dcm
RG1_J2KR.dcm
RG1_UNCI.dcm
RG1_UNCR.dcm
RG3_J2KI.dcm
RG3_J2KR.dcm
RG3_UNCI.dcm
RG3_UNCR.dcm
"

# Various compression formats (JPEG, JPEG2000, JPEG-LS, RLE, HTJ2K)
COMPRESSION_FILES="
JPEG-LL.dcm
JPEG2000_UNC.dcm
JPGLosslessP14SV1_1s_1f_8b.dcm
HTJ2KLossless_08_RGB.dcm
HTJ2K_08_RGB.dcm
JLSL_08_07_0_1F.dcm
JLSL_16_15_1_1F.dcm
JLSL_RGB_ILV0.dcm
JLSL_RGB_ILV1.dcm
JLSL_RGB_ILV2.dcm
JLSN_RGB_ILV0.dcm
693_J2KR.dcm
693_UNCI.dcm
693_UNCR.dcm
"

# Color and Secondary Capture datasets
COLOR_SC_FILES="
SC_rgb.dcm
SC_rgb_16bit.dcm
SC_rgb_32bit.dcm
SC_rgb_expb.dcm
SC_rgb_expb_16bit.dcm
SC_rgb_expb_32bit.dcm
SC_rgb_dcmtk_ebcr_dcmd.dcm
SC_rgb_dcmtk_ebcyn1_dcmd.dcm
SC_rgb_dcmtk_ebcyn2_dcmd.dcm
SC_rgb_dcmtk_ebcynp_dcmd.dcm
SC_rgb_dcmtk_ebcys2_dcmd.dcm
SC_rgb_dcmtk_ebcys4_dcmd.dcm
SC_rgb_gdcm2k_uncompressed.dcm
SC_ybr_full_uncompressed.dcm
color-pl.dcm
color-px.dcm
OT-PAL-8-face.dcm
"

# Special/edge case datasets
SPECIAL_FILES="
mlut_18.dcm
vlut_04.dcm
explicit_VR-UN.dcm
parametric_map_float.dcm
parametric_map_double_float.dcm
"

# Minimal set for quick testing
MINIMAL_FILES="
emri_small.dcm
liver.dcm
SC_rgb.dcm
"

if [ "$ORTHANC_SEED_ENABLED" != "true" ]; then
  echo "Orthanc seeding disabled."
  exit 0
fi

auth_args=""
if [ -n "$ORTHANC_USERNAME" ] && [ -n "$ORTHANC_PASSWORD" ]; then
  auth_args="-u ${ORTHANC_USERNAME}:${ORTHANC_PASSWORD}"
fi

echo "Waiting for Orthanc at ${ORTHANC_URL}..."
tries=0
until curl -fsS $auth_args "${ORTHANC_URL}/system" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    echo "Orthanc did not become ready."
    exit 1
  fi
  sleep 1
done

existing_instances="$(curl -fsS $auth_args "${ORTHANC_URL}/instances" || true)"
if [ "${#existing_instances}" -gt 2 ]; then
  echo "Orthanc already has instances, skipping seed."
  exit 0
fi

# Select files based on seed mode
case "$ORTHANC_SEED_MODE" in
  minimal)
    echo "Seeding mode: minimal (3 files)"
    ALL_FILES="$MINIMAL_FILES"
    ;;
  mri)
    echo "Seeding mode: MRI only"
    ALL_FILES="$MRI_FILES"
    ;;
  ct)
    echo "Seeding mode: CT only"
    ALL_FILES="$CT_FILES"
    ;;
  multiframe)
    echo "Seeding mode: Multi-frame only"
    ALL_FILES="$MULTIFRAME_FILES"
    ;;
  us)
    echo "Seeding mode: Ultrasound only"
    ALL_FILES="$US_FILES"
    ;;
  rg)
    echo "Seeding mode: Radiography only"
    ALL_FILES="$RG_FILES"
    ;;
  compression)
    echo "Seeding mode: Various compression formats"
    ALL_FILES="$COMPRESSION_FILES"
    ;;
  color)
    echo "Seeding mode: Color/SC images"
    ALL_FILES="$COLOR_SC_FILES"
    ;;
  full)
    echo "Seeding mode: full (all test datasets)"
    ALL_FILES="$MRI_FILES $CT_FILES $MULTIFRAME_FILES $US_FILES $RG_FILES $COMPRESSION_FILES $COLOR_SC_FILES $SPECIAL_FILES"
    ;;
  *)
    echo "Unknown seed mode: $ORTHANC_SEED_MODE, using minimal"
    ALL_FILES="$MINIMAL_FILES"
    ;;
esac

tmp_dir="$(mktemp -d)"
trap "rm -rf $tmp_dir" EXIT

success_count=0
fail_count=0

for file in $ALL_FILES; do
  # Skip empty lines
  [ -z "$file" ] && continue
  
  url="${PYDICOM_DATA_BASE}/${file}"
  file_path="${tmp_dir}/${file}"
  
  echo "Downloading ${file}..."
  if curl -fsSL "$url" -o "$file_path" 2>/dev/null; then
    echo "Uploading ${file} to Orthanc..."
    if curl -fsS $auth_args -H "Content-Type: application/dicom" --data-binary @"$file_path" "${ORTHANC_URL}/instances" >/dev/null 2>&1; then
      success_count=$((success_count + 1))
      echo "  OK"
    else
      fail_count=$((fail_count + 1))
      echo "  Failed to upload"
    fi
    rm -f "$file_path"
  else
    fail_count=$((fail_count + 1))
    echo "  Failed to download"
  fi
done

echo ""
echo "Seeding complete: $success_count succeeded, $fail_count failed"
