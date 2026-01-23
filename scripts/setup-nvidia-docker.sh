#!/bin/bash
# Setup NVIDIA Container Toolkit for Docker GPU support
# Run with: sudo ./scripts/setup-nvidia-docker.sh

set -e

echo "=== NVIDIA Container Toolkit Setup ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Bitte als root ausfuehren: sudo $0"
  exit 1
fi

# Check if NVIDIA driver is installed
if ! command -v nvidia-smi &> /dev/null; then
  echo "FEHLER: NVIDIA Treiber nicht gefunden. Bitte zuerst installieren."
  exit 1
fi

echo "NVIDIA Treiber gefunden:"
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader

echo ""
echo "1. Repository hinzufuegen..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

echo ""
echo "2. nvidia-container-toolkit installieren..."
apt-get update
apt-get install -y nvidia-container-toolkit

echo ""
echo "3. Docker Runtime konfigurieren..."
nvidia-ctk runtime configure --runtime=docker

echo ""
echo "4. Docker neu starten..."
systemctl restart docker

echo ""
echo "5. Installation testen..."
if docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi; then
  echo ""
  echo "=== ERFOLG: GPU-Support fuer Docker ist eingerichtet! ==="
  echo ""
  echo "Du kannst jetzt den GPU-Stack starten mit:"
  echo "  docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile gpu up --build"
else
  echo ""
  echo "=== FEHLER: Test fehlgeschlagen. Evtl. Neustart erforderlich. ==="
  exit 1
fi
