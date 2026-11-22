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

`scripts/selectable-markdown.lua` renders Markdown syntax as real DOM text.
Heading markers, formatting delimiters, list prefixes, and link destinations
must remain in both `textContent` and native selections, without JavaScript or
copy-event handlers. Links use absolute website URLs so selected text remains
portable. Complex structures retain their Markdown source in preformatted blocks.
The regression test round-trips rendered text back through Pandoc.
