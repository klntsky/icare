import asyncio
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin


class RenderedBody(HTMLParser):
    void_tags = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self):
        super().__init__()
        self.in_body = False
        self.stack = []
        self.source = []
        self.visible = []
        self.tags = []
        self.elements = []
        self.links = []
        self.headings = []
        self.displays = []

    def handle_starttag(self, tag, attrs):
        if tag == "body":
            self.in_body = True
        if not self.in_body:
            return
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        syntax = "markdown-syntax" in classes
        heading = "markdown-heading" in classes
        display = "markdown-display" in classes
        inserted = syntax or heading or display
        assert not inserted or tag == "span", (tag, attrs)
        if not inserted:
            self.tags.append(tag)
            self.elements.append((tag, attrs))
        if tag == "a" and "href" in attrs:
            self.links.append(attrs["href"])
        if display:
            assert "data-rendered" in attrs, attrs
            self.displays.append(attrs["data-rendered"])
            self.visible.append(attrs["data-rendered"])
        if tag not in self.void_tags:
            self.stack.append((tag, syntax, heading, display))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.void_tags:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.in_body:
            return
        assert self.stack and self.stack[-1][0] == tag, (tag, self.stack)
        self.stack.pop()
        if tag == "body":
            self.in_body = False

    def handle_data(self, data):
        if not self.in_body:
            return
        self.source.append(data)
        assert not any(frame[3] for frame in self.stack), (
            "Rendered-only spans must be empty", data
        )
        if any(frame[2] for frame in self.stack):
            self.headings.append(data)
        if not any(frame[1] or frame[2] for frame in self.stack):
            self.visible.append(data)


async def run(input_bytes, *command):
    process = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    output, error = await process.communicate(input_bytes)
    assert process.returncode == 0, error.decode()
    return output.decode()


def without_whitespace(text):
    return "".join(text.split())


async def main():
    page_url = "https://icare.how/to/test/"
    markdown = r"""---
name: selectable-fixture
title: "Fixture title"
description: "A generated introduction with **formatting**."
tags:
  - source
  - "escaped punctuation"
---

# First heading

## Second heading

"A quoted paragraph before the next heading."

### Third heading

#### Fourth heading

##### Fifth heading

###### Sixth heading

**Bold**, *emphasis*, ~~removed~~, `inline * code`, literal \*stars\*, x^2^ and H~2~O.

Escapes: \\ \[brackets\] \# \_ \` \! and C:\\work\\file.
Punctuation: "quoted", 'single', -- dash --- ellipsis... & < >.
Literal entities: &amp; &#35; and \&amp;.

Use **understand-intent**, [local](references/example.md#example),
[fragment](#first-heading), [parent](../other/SKILL.md?mode=raw#part),
and [external](https://example.org/a?q=one&b=two).

- First item
    - Nested item with **bold**
        1. Nested ordered item
        2. Another nested item
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
const path = "C:\\work\\file";
const markup = "<b>&amp;</b>";
````

| Name | Value |
| ---- | ----- |
| **cell** | [table link](/to/test/) |
| escaped \| pipe | `code \ value` |

Term
: Definition.

Footnote reference.[^note] More text.

[^note]: Footnote **content** with [note link](notes/detail.md).

Math $x^2$.

---
"""
    original_html = await run(
        markdown.encode(),
        "pandoc", "--from=markdown+yaml_metadata_block", "--to=html5",
        "--standalone",
        "--lua-filter=scripts/skill-intro.lua",
        "--lua-filter=scripts/skill-links.lua",
        "--include-before-body=scripts/content-start.html",
        "--include-after-body=scripts/content-end.html",
        "--metadata=skill-names=understand-intent test",
        "--metadata=site-url=https://icare.how",
        f"--metadata=page-url={page_url}",
    )
    decoration = (
        '<a class="site-logo" href="/" aria-label="Home">'
        '<span aria-hidden="true">💊</span></a>'
        '<aside class="decoration">Decorative text absent from source</aside>'
    )
    assert "<body>" in original_html
    original_html = original_html.replace("<body>", "<body>" + decoration, 1)
    html = await run(
        markdown.encode() + b"\0" + original_html.encode(),
        sys.executable, "scripts/selectable-markdown.py", page_url,
    )
    original = RenderedBody()
    original.feed(original_html)
    original.close()
    rendered = RenderedBody()
    rendered.feed(html)
    rendered.close()
    assert not rendered.stack and not rendered.in_body
    selected = "".join(rendered.source)
    assert without_whitespace(selected) == without_whitespace(markdown), selected
    assert rendered.tags == original.tags, (rendered.tags, original.tags)
    assert rendered.elements == [
        (
            tag,
            {
                key: urljoin(page_url, value) if tag == "a" and key == "href" else value
                for key, value in attrs.items()
            },
        )
        for tag, attrs in original.elements
    ], rendered.elements
    assert without_whitespace("".join(rendered.visible)) == without_whitespace(
        "".join(original.visible)
    ), "".join(rendered.visible)
    assert rendered.links == [urljoin(page_url, link) for link in original.links], (
        rendered.links
    )
    for target in [
        "https://icare.how/",
        "https://icare.how/to/understand-intent/",
        "https://icare.how/to/test/references/example.md#example",
        "https://icare.how/to/test/#first-heading",
        "https://icare.how/to/other/SKILL.md?mode=raw#part",
        "https://example.org/a?q=one&b=two",
        "https://icare.how/to/test/",
        "https://icare.how/to/test/notes/detail.md",
    ]:
        assert target in rendered.links, (target, rendered.links)
    assert "https://icare.how/to/understand-intent/" not in selected
    assert "**understand-intent**" in without_whitespace(selected)
    assert without_whitespace("".join(rendered.headings)) == "#" * 23
    assert "💊" in "".join(rendered.displays)
    for tag in [
        "main", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em",
        "del", "code", "sup", "sub", "ul", "ol", "li", "blockquote",
        "pre", "table", "thead", "tbody", "tr", "th", "td",
        "dl", "dt", "dd", "hr",
    ]:
        assert tag in rendered.tags, (tag, rendered.tags)
    assert rendered.tags.count("pre") == 1
    assert rendered.tags.count("ul") == 2
    assert rendered.tags.count("ol") == 3
    print(
        "PASS: body text preserves original Markdown, metadata, escapes, and "
        "relative links while semantic HTML, decorations, and absolute links render"
    )


if __name__ == "__main__":
    asyncio.run(main())
