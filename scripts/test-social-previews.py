import asyncio
import sys
from html.parser import HTMLParser


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.in_body = False
        self.metadata = {}
        self.body = []

    def handle_starttag(self, tag, attrs):
        if tag == "head":
            self.in_head = True
        elif tag == "body":
            self.in_body = True
        if tag == "meta" and self.in_head:
            attrs = dict(attrs)
            key = attrs.get("property", attrs.get("name"))
            if key:
                self.metadata.setdefault(key, []).append(attrs.get("content"))

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False
        elif tag == "body":
            self.in_body = False

    def handle_data(self, data):
        if self.in_body:
            self.body.append(data)


async def run(data, *command):
    process = await asyncio.create_subprocess_exec(
        *command, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    output, error = await process.communicate(data.encode())
    assert process.returncode == 0, error.decode()
    return output.decode()


async def main():
    for description, expected in [
        ('\'Use "quoted" goals & `<context>` safely.\'', 'Use “quoted” goals & <context> safely.'),
        ('>\n  Capture intent across\n  multiple lines.', 'Capture intent across multiple lines.'),
    ]:
        source = f"---\nname: example\ndescription: {description}\n---\n\n# Example\n"
        url = "https://icare.how/to/example/"
        rendered = await run(
            source, "pandoc", "--from=markdown+yaml_metadata_block", "--to=html5",
            "--standalone", "--lua-filter=scripts/skill-intro.lua",
            "--include-in-header=scripts/site-head.html",
            "--include-before-body=scripts/content-start.html",
            "--include-after-body=scripts/content-end.html",
            "--metadata=pagetitle=example", f"--metadata=page-url={url}",
        )
        output = await run(
            source + "\0" + rendered, sys.executable,
            "scripts/selectable-markdown.py", url,
        )
        page = Page()
        page.feed(output)
        for key in ["description", "og:description", "twitter:description"]:
            assert page.metadata[key] == [expected], (key, page.metadata)
        assert page.metadata["og:title"] == ["example"]
        assert page.metadata["twitter:title"] == ["example"]
        assert page.metadata["og:type"] == ["website"]
        assert page.metadata["twitter:card"] == ["summary"]
        assert page.metadata["og:url"] == [url]
        assert "".join("".join(page.body).split()) == "".join(source.split())
    print("PASS: social previews use escaped, multiline MDC descriptions without changing body source text")


if __name__ == "__main__":
    asyncio.run(main())
