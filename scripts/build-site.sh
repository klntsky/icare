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
  local source
  local sources=("$1")
  if [[ -n "${5:-}" && -f "$5" ]]; then
    sources=("$5" "$1")
  fi
  {
    for source in "${sources[@]}"; do
      cat "$source"
      printf '\n\n'
    done
    printf '\0'
    pandoc "${sources[@]}" \
    --from=markdown+yaml_metadata_block \
    --to=html5 \
    --lua-filter=scripts/skill-intro.lua \
    --lua-filter=scripts/skill-links.lua \
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
    --metadata="page-url=$4"
  } | python3 scripts/selectable-markdown.py "$4" > "$2"
}

render README.md "$output/index.html" icare.how https://icare.how/

for name in "${skill_names[@]}"; do
  directory="skills/$name"
  source="$directory/SKILL.md"
  page="$output/to/$name"
  mkdir -p "$page"
  cp -R "$directory/." "$page/"
  render "$source" "$page/index.html" "$name" "https://icare.how/to/$name/" "$directory/README.md"
done

touch "$output/.nojekyll"
