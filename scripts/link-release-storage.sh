#!/usr/bin/env bash
# Prepare an unpublished release to use the persistent runtime data directory.
set -euo pipefail
fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# == 2 && -d $1 && -d $2 ]] || fail 'Usage: link-release-storage.sh RELEASE_DIR PERSISTENT_DATA_DIR'
release=$(realpath -e -- "$1")
store=$(realpath -e -- "$2")
case "$store/" in "$release/"*) fail 'Persistent storage must be outside the release.' ;; esac
case "$release/" in "$store/"*) fail 'Release must be outside persistent storage.' ;; esac
link=$release/data
if [[ -L $link ]]; then
  [[ $(realpath -e -- "$link") == "$store" ]] || fail 'Existing data symlink points to another location.'
elif [[ -e $link ]]; then
  [[ -d $link ]] || fail 'Existing data path is not a directory.'
  shopt -s nullglob dotglob
  entries=("$link"/*)
  if (( ${#entries[@]} )); then
    [[ ${#entries[@]} == 1 && ${entries[0]} == "$link/.gitkeep" && -f ${entries[0]} && ! -L ${entries[0]} && ! -s ${entries[0]} ]] || fail 'Refusing to replace data directory containing runtime files.'
  fi
  backup=$(mktemp -d "$release/.data-placeholder.XXXXXX")
  mv -T -- "$link" "$backup/data"
  if ! ln -sT -- "$store" "$link"; then
    mv -T -- "$backup/data" "$link"
    fail 'Could not link persistent storage; restored original directory.'
  fi
else
  ln -sT -- "$store" "$link"
fi
[[ -L $link && $(realpath -e -- "$link") == "$store" ]] || fail 'Persistent storage link did not verify.'
