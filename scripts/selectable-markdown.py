import asyncio
import bisect
import difflib
import html
import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urljoin


@dataclass
class Text:
    value: str
    in_content: bool
    in_body: bool
    heading: int | None
    parts: list[str] = field(default_factory=list)


def syntax(value):
    return '<span class="markdown-syntax">' + html.escape(value, quote=False) + '</span>' if value else ''


def display(value):
    return '<span class="markdown-display" data-rendered="' + html.escape(value, quote=True) + '"></span>' if value else ''


class Page(HTMLParser):
    def __init__(self, page_url):
        super().__init__(convert_charrefs=False)
        self.page_url = page_url
        self.tokens = []
        self.stack = []
        self.content_depth = None
        self.content_start = None

    def handle_starttag(self, tag, attrs):
        markup = self.get_starttag_text()
        if tag in {"a", "img"}:
            attribute = "href" if tag == "a" else "src"
            pattern = r'(\s' + attribute + r'\s*=\s*)([\'"])(.*?)\2'
            markup = re.sub(pattern, lambda match: match[1] + '"' + html.escape(
                urljoin(self.page_url, html.unescape(match[3])), quote=True
            ) + '"', markup, flags=re.IGNORECASE | re.DOTALL)
        self.tokens.append(markup)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(tag)
            if tag == "main" and dict(attrs).get("id") == "content":
                self.content_depth = len(self.stack)
                self.content_start = len(self.tokens)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        self.tokens.append('</' + tag + '>')
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            if self.content_depth is not None and index < self.content_depth:
                self.content_depth = None
            del self.stack[index:]

    def handle_data(self, data):
        heading = next((int(tag[1]) for tag in reversed(self.stack) if re.fullmatch(r'h[1-6]', tag)), None)
        self.tokens.append(Text(data, self.content_depth is not None, "body" in self.stack, heading))

    def handle_entityref(self, name):
        self.handle_data(html.unescape('&' + name + ';'))

    def handle_charref(self, name):
        self.handle_data(html.unescape('&#' + name + ';'))

    def handle_comment(self, data):
        self.tokens.append('<!--' + data + '-->')

    def handle_decl(self, declaration):
        self.tokens.append('<!' + declaration + '>')

    def handle_pi(self, data):
        self.tokens.append('<?' + data + '>')


def render(source, markup, page_url):
    page = Page(page_url)
    page.feed(markup)
    page.close()
    if page.content_start is None:
        raise ValueError('Rendered page has no main#content')
    texts = [token for token in page.tokens if isinstance(token, Text) and token.in_content and token.value.strip()]
    starts = []
    position = 0
    for token in texts:
        starts.append(position)
        position += len(token.value)
    rendered = ''.join(token.value for token in texts)
    headings = [(match.start(1), match.end(1), len(match[1].rstrip()))
                for match in re.finditer(r'(?m)^(?:[ \t>]|[-+*][ \t]+|\d+[.)][ \t]+)*(#{1,6}[ \t]+)', source)]

    def hidden(start, end, token):
        parts = []
        cursor = start
        for left, right, level in headings:
            if token.heading == level and start <= left and right <= end:
                parts.append(syntax(source[cursor:left]))
                parts.append('<span class="markdown-heading">' + html.escape(source[left:right]) + '</span>')
                cursor = right
        parts.append(syntax(source[cursor:end]))
        return ''.join(parts)

    def slices(start, end):
        index = max(0, bisect.bisect_right(starts, start) - 1)
        while index < len(texts) and start < end:
            token = texts[index]
            right = min(end, starts[index] + len(token.value))
            yield token, start - starts[index], right - starts[index]
            start = right
            index += 1

    # Keep Pandoc's element tree and typography; never reserialize the Markdown source.
    for operation, left, right, begin, end in difflib.SequenceMatcher(None, source, rendered, autojunk=False).get_opcodes():
        if operation == 'equal':
            for token, start, stop in slices(begin, end):
                token.parts.append(html.escape(token.value[start:stop], quote=False))
        else:
            if left != right and texts:
                index = min(len(texts) - 1, max(0, bisect.bisect_right(starts, begin) - 1))
                token = texts[index]
                following = texts[min(len(texts) - 1, bisect.bisect_right(starts, end) - 1)]
                split = next((start for start, stop, level in headings
                              if following.heading == level and left <= start and stop <= right), right)
                token.parts.append(hidden(left, split, token))
                following.parts.append(hidden(split, right, following))
            for token, start, stop in slices(begin, end):
                token.parts.append(display(token.value[start:stop]))

    output = []
    for index, token in enumerate(page.tokens):
        if not texts and index == page.content_start:
            output.append(syntax(source))
        if not isinstance(token, Text):
            output.append(token)
        elif token.in_content and token.value.strip():
            output.extend(token.parts)
        elif token.in_body and token.value.strip():
            output.append(display(token.value))
        elif token.in_body:
            output.append(html.escape(token.value, quote=False))
        else:
            output.append(token.value)
    result = ''.join(output)
    check = Page(page_url)
    check.feed(result)
    actual = ''.join(token.value for token in check.tokens if isinstance(token, Text) and token.in_body)
    if re.sub(r'\s+', '', actual) != re.sub(r'\s+', '', source):
        raise ValueError('Rendered body text differs from the original Markdown')
    return result


async def main():
    process = await asyncio.create_subprocess_exec('cat', stdout=asyncio.subprocess.PIPE)
    data, _ = await process.communicate()
    if process.returncode:
        raise SystemExit(process.returncode)
    source, markup = data.decode().split('\0', 1)
    print(render(source, markup, sys.argv[1]), end='')


if __name__ == '__main__':
    asyncio.run(main())
