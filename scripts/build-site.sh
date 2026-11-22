#!/usr/bin/env bash
set -euo pipefail

output=$(realpath -m "${1:?Usage: bash scripts/build-site.sh OUTPUT_DIRECTORY}")
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir "$output"

skill_names=()
for source in skills/*/SKILL.md; do
  name=${source#skills/}
  skill_names+=("${name%/SKILL.md}")
done

render() {
  pandoc "$1" \
    --from=markdown+yaml_metadata_block \
    --to=html5 \
    --lua-filter=scripts/skill-intro.lua \
    --lua-filter=scripts/skill-links.lua \
    --lua-filter=scripts/selectable-markdown.lua \
    --standalone \
    --include-in-header=scripts/github-corner-style.html \
    --include-in-header=scripts/site-head.html \
    --include-before-body=scripts/github-corner.html \
    --include-before-body=scripts/site-logo.html \
    --metadata="pagetitle=$3" \
    --include-before-body=scripts/content-start.html \
    --include-after-body=scripts/content-end.html \
    --metadata=lang:en \
    --metadata="skill-names=${skill_names[*]}" \
    --metadata="site-url=https://icare.how" \
    --metadata="page-url=$4" \
    --output="$2"
}

render README.md "$output/index.html" icare.how https://icare.how/

for name in "${skill_names[@]}"; do
  directory="skills/$name"
  source="$directory/SKILL.md"
  page="$output/to/$name"
  mkdir -p "$page"
  cp -R "$directory/." "$page/"
  render "$source" "$page/index.html" "$name" "https://icare.how/to/$name/"
done

touch "$output/.nojekyll"
