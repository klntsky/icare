import asyncio
import json
from html.parser import HTMLParser


class RenderedText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.links = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs)["href"])


async def pandoc(text, *arguments):
    process = await asyncio.create_subprocess_exec(
        "pandoc", *arguments,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    output, error = await process.communicate(text.encode())
    if process.returncode:
        raise AssertionError(error.decode())
    return output.decode()


def nodes(value, kind):
    if isinstance(value, dict):
        if value.get("t") == kind:
            yield value
        for child in value.values():
            yield from nodes(child, kind)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child, kind)


async def main():
    markdown = """# First heading

## Second heading

### Third heading

#### Fourth heading

##### Fifth heading

###### Sixth heading

**Bold**, *emphasis*, ~~removed~~, `inline * code`, literal \\*stars\\*, x^2^ and H~2~O.

Use **understand-intent**, [local](references/example.md#example), [fragment](#first-heading), and [external](https://example.org/a?q=one&b=two).

- First item
  - Nested item with **bold**
- Second item

3. Third item
4. Fourth item

> Quoted paragraph
>
> ## Quoted heading
>
> Another paragraph.

````javascript
const value = "```";
````

| Name | Value |
| ---- | ----- |
| **cell** | [table link](/to/test/) |

Term
: Definition.

Footnote reference.[^note] More text.

[^note]: Footnote **content**.

Math $x^2$.

---
"""
    html = await pandoc(
        markdown, "--from=markdown", "--to=html5",
        "--lua-filter=scripts/skill-links.lua",
        "--lua-filter=scripts/selectable-markdown.lua",
        "--metadata=skill-names=understand-intent test",
        "--metadata=site-url=https://icare.how",
        "--metadata=page-url=https://icare.how/to/test/",
    )
    rendered = RenderedText()
    rendered.feed(html)
    text_content = "".join(rendered.parts)
    selected = json.loads(await pandoc(text_content, "--from=markdown", "--to=json"))
    headers = list(nodes(selected, "Header"))
    assert [header["c"][0] for header in headers] == [1, 2, 3, 4, 5, 6, 2]
    for kind in ["Strong", "Emph", "Strikeout", "Code", "Superscript", "Subscript",
                 "BulletList", "OrderedList", "BlockQuote", "Table", "DefinitionList", "Note", "Math", "HorizontalRule"]:
        assert list(nodes(selected, kind)), (kind, text_content)
    assert next(nodes(selected, "CodeBlock"))["c"][1] == 'const value = "```";'
    targets = [link["c"][2][0] for link in nodes(selected, "Link")]
    assert targets == [
        "https://icare.how/to/understand-intent/",
        "https://icare.how/to/test/references/example.md#example",
        "https://icare.how/to/test/#first-heading",
        "https://example.org/a?q=one&b=two",
        "https://icare.how/to/test/",
    ], targets
    assert rendered.links == targets[:-1], rendered.links
    bullet_lists = list(nodes(selected, "BulletList"))
    assert len(bullet_lists) == 2 and len(bullet_lists[0]["c"]) == 2
    assert next(nodes(selected, "OrderedList"))["c"][0][0] == 3
    assert next(nodes(selected, "Code"))["c"][1] == "inline * code"
    assert "literal \\*stars\\*" in text_content
    print("PASS: textContent round-trips headings, links, nested lists, quotes, code, tables, notes, and inline formatting")


if __name__ == "__main__":
    asyncio.run(main())
