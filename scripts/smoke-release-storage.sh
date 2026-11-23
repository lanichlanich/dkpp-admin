#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/dkpp-release-storage.XXXXXX")
trap 'rm -rf -- "$fixture"' EXIT
store="$fixture/persistent"
release="$fixture/release"
mkdir -p -- "$release/data" "$store/service-archive"
touch -- "$release/data/.gitkeep"
printf 'fixture document' > "$store/service-archive/document.pdf"
link_storage() { bash "$script_dir/link-release-storage.sh" "$1" "$store"; }
link_storage "$release"
test -L "$release/data"
test "$(readlink -f -- "$release/data")" = "$store"
cmp -- "$release/data/service-archive/document.pdf" "$store/service-archive/document.pdf"
link_storage "$release"
mkdir -p -- "$fixture/unsafe/data" "$fixture/wrong" "$fixture/other-store"
printf 'must keep' > "$fixture/unsafe/data/.unexpected"
ln -sT -- "$fixture/other-store" "$fixture/wrong/data"
if link_storage "$fixture/unsafe" || link_storage "$fixture/wrong"; then exit 1; fi
test "$(<"$fixture/unsafe/data/.unexpected")" = 'must keep'
test "$(readlink -f -- "$fixture/wrong/data")" = "$fixture/other-store"
printf '%s\n' 'PASS release storage: tracked marker, direct link, object access, idempotence and refusal to replace unknown data'
