#!/usr/bin/env bash
# ANIMA - uji kecepatan render di server Linux tanpa GPU (Ubuntu 22.04/24.04).
# Merakit proyek Remotion dari mromidev/claude-animated-shorts (sama seperti di laptop),
# lalu merender adegan jembatan dengan beberapa jumlah proses paralel.
#
# Pakai:   bash bench.sh            (jalankan sebagai user biasa yang punya sudo)
# Hasil:   ringkasan di akhir + ~/anima-bench/hasil.txt
set -euo pipefail

DIR="$HOME/anima-bench"
CORES=$(nproc)
RAM_GB=$(awk '/MemTotal/ {printf "%d", $2/1048576}' /proc/meminfo)
# ~2 GB RAM per proses render, sisakan 4 GB untuk sistem.
MAX_C=$(( (RAM_GB - 4) / 2 )); [ "$MAX_C" -gt "$CORES" ] && MAX_C=$CORES; [ "$MAX_C" -lt 1 ] && MAX_C=1
HALF_C=$(( MAX_C / 2 )); [ "$HALF_C" -lt 1 ] && HALF_C=1

echo "== Server: $CORES thread CPU, ${RAM_GB} GB RAM -> uji paralel $HALF_C dan $MAX_C proses"
grep -q avx2 /proc/cpuinfo && echo "== AVX2: ada (bagus untuk render software)" || echo "== PERINGATAN: AVX2 tidak terlihat. Di Proxmox set CPU type VM ke 'host'."

echo "== 1/4 Paket sistem (Node.js 22, git, library Chrome headless)"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git ca-certificates >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
ASOUND=libasound2; apt-cache show libasound2t64 >/dev/null 2>&1 && ASOUND=libasound2t64
sudo apt-get install -y -qq libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev "$ASOUND" libxrandr2 libxkbcommon-dev \
  libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 >/dev/null
echo "   node $(node -v)"

echo "== 2/4 Merakit proyek Remotion di $DIR"
rm -rf "$DIR"; mkdir -p "$DIR"; cd "$DIR"
git clone -q --depth 1 https://github.com/mromidev/claude-animated-shorts.git skill
mkdir -p src/videos out
cp -r skill/templates/bridge src/videos/bridge
cat > package.json <<'EOF'
{ "name": "anima-bench", "private": true, "type": "module" }
EOF
cat > src/index.ts <<'EOF'
import { registerRoot } from 'remotion';
import { Root } from './Root';
registerRoot(Root);
EOF
cat > src/Root.tsx <<'EOF'
import React from 'react';
import { Composition } from 'remotion';
import { BridgeShort, BRIDGE_FRAMES } from './videos/bridge/Bridge';
export const Root: React.FC = () => (
  <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
);
EOF

echo "== 3/4 npm install (Remotion, three.js) - beberapa menit"
npm install --no-fund --no-audit --loglevel=error remotion @remotion/cli @remotion/three three @react-three/fiber \
  postprocessing react react-dom >/dev/null
# 3.2.x membuat composer asinkron -> frame kosong di Remotion. Kunci ke 3.0.4 (sama seperti di laptop).
npm install --no-fund --no-audit --loglevel=error --save-exact @react-three/postprocessing@3.0.4 >/dev/null
npx remotion browser ensure >/dev/null

export REMOTION_TMP="$DIR/tmp" TEMP="$DIR/tmp" TMP="$DIR/tmp" TMPDIR="$DIR/tmp"; mkdir -p "$TMPDIR"

run() { # label, frames, scale, concurrency
  local t0=$(date +%s)
  npx remotion render src/index.ts BridgeShort "out/$1.mp4" --frames="$2" --scale="$3" --concurrency="$4" \
    --gl=swangle --timeout=600000 --log=error >/dev/null 2>"out/$1.log" || { echo "   $1 GAGAL, lihat out/$1.log"; return; }
  local dt=$(( $(date +%s) - t0 ))
  local n=$(( ${2#*-} - ${2%-*} + 1 ))
  printf "   %-28s %4d frame  %5d detik  -> %6.2f detik/frame\n" "$1" "$n" "$dt" "$(echo "$dt / $n" | bc -l)" | tee -a hasil.txt
  rm -rf "$TMPDIR"/remotion-* "$TMPDIR"/puppeteer_* 2>/dev/null || true
}
command -v bc >/dev/null || sudo apt-get install -y -qq bc >/dev/null

echo "== 4/4 Uji render (adegan jembatan, efek lengkap)" | tee hasil.txt
echo "   server: $CORES thread, ${RAM_GB} GB RAM, $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2)" >> hasil.txt
run "540p-1proses"            400-409 0.5 1
run "540p-${HALF_C}proses"    400-$((399 + HALF_C * 4)) 0.5 "$HALF_C"
run "540p-${MAX_C}proses"     400-$((399 + MAX_C * 4)) 0.5 "$MAX_C"
run "1080p-${MAX_C}proses"    400-$((399 + MAX_C * 4)) 1   "$MAX_C"

echo
echo "== Selesai. Pembanding laptop (i7-4710MQ): 540p efek lengkap = 28.2 detik/frame (termasuk persiapan)."
echo "   Satu video = 2025 frame. Perkiraan: detik/frame x 2025 / 3600 = jam."
echo "   Kirim isi $DIR/hasil.txt ke Claude."
