#!/usr/bin/env bash
set -euo pipefail

output=$(realpath -m "${1:?Usage: bash scripts/build-site.sh OUTPUT_DIRECTORY}")
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir "$output"

render() {
  pandoc "$1" \
    --from=markdown+yaml_metadata_block \
    --to=html5 \
    --standalone \
    --metadata="pagetitle=$3" \
    --metadata=lang:en \
    --output="$2"
}

render README.md "$output/index.html" icare.how

for source in skills/*/SKILL.md; do
  directory=$(dirname "$source")
  name=$(basename "$directory")
  page="$output/to/$name"
  mkdir -p "$page"
  cp -R "$directory/." "$page/"
  render "$source" "$page/index.html" "$name"
done

touch "$output/.nojekyll"
