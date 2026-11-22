import asyncio
import xml.etree.ElementTree as ET


async def main():
    markdown = """Use **understand-intent**, then **capture-intent**.

Keep **missing-skill** and **understand-intent extra** bold but unlinked.

`**understand-intent**` and **`understand-intent`** are code examples.

```markdown
**capture-intent**
```

[**understand-intent**](https://example.com/guide)

[Repository link](skills/capture-intent/SKILL.md#capture-intent)
"""
    process = await asyncio.create_subprocess_exec(
        "pandoc", "--from=markdown+yaml_metadata_block", "--to=html5",
        "--lua-filter=scripts/skill-links.lua",
        "--no-highlight",
        "--metadata=skill-names=understand-intent capture-intent",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
    )
    output, _ = await process.communicate(markdown.encode())
    if process.returncode:
        raise SystemExit(process.returncode)
    document = ET.fromstring("<div>" + output.decode() + "</div>")
    links = [(link.get("href"), "".join(link.itertext()))
             for link in document.findall(".//a")]
    assert links == [
        ("/to/understand-intent/", "understand-intent"),
        ("/to/capture-intent/", "capture-intent"),
        ("https://example.com/guide", "understand-intent"),
        ("/to/capture-intent/#capture-intent", "Repository link"),
    ], links
    assert [link.text for link in document.findall(".//strong/a")] == [
        "understand-intent", "capture-intent",
    ]
    assert document.find(".//a/a") is None
    assert document.find(".//code/a") is None
    assert "missing-skill" in ["".join(node.itertext())
                               for node in document.findall(".//strong")]
    print("PASS: bold skill links, preserved emphasis, code examples, unknown names, and existing links")


if __name__ == "__main__":
    asyncio.run(main())
