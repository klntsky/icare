# Skill catalog

When adding or removing skills, update the linked skill list in README.md.
Preserve the existing order and append new skills at the end of the list.
When renaming a skill, update its existing entry in place.
This standing approval applies only to maintaining the skill list; other README.md changes require explicit user approval.

# Website skill references

Use `**known-skill-name**` to reference another skill. The website builder links
these references to `/to/known-skill-name/` while preserving bold styling.
Code examples, unknown skill names, and existing links retain their meaning.

# Website selectable Markdown

`scripts/selectable-markdown.py` preserves Pandoc's normal rendered HTML while
aligning its text with the original Markdown. Whole-body `textContent` must equal
the original source, including frontmatter and escapes, except for whitespace.
Only heading hashes are visibly added; other source syntax remains hidden but
selectable, without JavaScript or copy handlers. Clickable links use absolute URLs
without rewriting the original source text. Regression tests check source identity
and preservation of the rendered HTML structure and visible text.

# Website social previews

Skill previews use the MDC description that Pandoc extracts into the standard
description meta tag. `scripts/selectable-markdown.py` adds matching Open Graph
and Twitter metadata to the built HTML head, with escaped attribute values,
without JavaScript.
