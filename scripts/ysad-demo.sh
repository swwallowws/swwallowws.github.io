#!/usr/bin/env bash
# Copies YSAD's web demo into the showcase (public/demos/ysad/), since its own
# repo is private and has no public page. Only what the page runs: the
# generator ships compiled (ysad.wasm), so no readable generator code comes
# along. Run again whenever yousuckatdrums/demo changes.
#   bash scripts/ysad-demo.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/../yousuckatdrums/demo"
out="$root/public/demos/ysad"

rm -rf "$out"
mkdir -p "$out"
cp "$src"/index.html "$src"/*.css "$src"/circle.js "$src"/dial.js "$src"/livegen.js \
  "$src"/player.js "$src"/synthkits.js "$src"/voices.js "$src"/patterns.json "$src"/ysad.wasm "$out/"
cp -R "$src/favicons" "$src/vendor" "$out/"
echo "copied YSAD's demo into $out"
