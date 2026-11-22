# Skill catalog

When adding or removing skills, update the linked skill list in README.md.
Preserve the existing order and append new skills at the end of the list.
When renaming a skill, update its existing entry in place.
This standing approval applies only to maintaining the skill list; other README.md changes require explicit user approval.

# Website skill references

Use `**known-skill-name**` to reference another skill. The website builder links
these references to `/to/known-skill-name/` while preserving bold styling.
Code examples, unknown skill names, and existing links retain their meaning.

# Website clipboard

`scripts/copy-markdown.js` converts selections inside `main#content` to Markdown
on copy, including formatting ancestors for partial selections. Output preserves
rendered formatting, not the source's exact delimiters or whitespace; formatting
without a Markdown equivalent remains HTML. The converter is vendored with its
license under `scripts/vendor/`. Without JavaScript, copying remains native.
