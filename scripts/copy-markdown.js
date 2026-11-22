(() => {
  const article = document.getElementById('content');
  const markdown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---',
    preformattedCode: true,
    defaultReplacement: (_content, node) => node.outerHTML,
  });

  markdown.addRule('layout', {
    filter: node => ['DIV', 'SPAN'].includes(node.nodeName)
      && !node.hasAttribute('style')
      && !node.matches('.math, .smallcaps'),
    replacement: (content, node) => node.isBlock ? `\n\n${content}\n\n` : content,
  });
  markdown.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: content => `~~${content}~~`,
  });
  markdown.addRule('taskCheckbox', {
    filter: node => node.matches('input[type="checkbox"]'),
    replacement: (_content, node) => node.checked ? '[x] ' : '[ ] ',
  });
  markdown.addRule('superscript', {
    filter: 'sup',
    replacement: content => `^${content.replace(/\s/g, '\\ ')}^`,
  });
  markdown.addRule('subscript', {
    filter: 'sub',
    replacement: content => `~${content.replace(/\s/g, '\\ ')}~`,
  });
  markdown.addRule('definitionList', {
    filter: 'dl',
    replacement: content => `\n\n${content.trim()}\n\n`,
  });
  markdown.addRule('definitionTerm', {
    filter: 'dt',
    replacement: content => `\n${content}\n`,
  });
  markdown.addRule('definition', {
    filter: 'dd',
    replacement: content => `\n:   ${content.trim().replace(/\n/g, '\n    ')}\n`,
  });
  markdown.addRule('footnoteReference', {
    filter: node => node.matches('a.footnote-ref'),
    replacement: (_content, node) => `[^${node.getAttribute('href').replace(/^#fn/, '')}]`,
  });
  markdown.addRule('footnoteBacklink', {
    filter: node => node.matches('a.footnote-back'),
    replacement: () => '',
  });
  markdown.addRule('footnotes', {
    filter: node => node.matches('[role="doc-endnotes"]'),
    replacement: (_content, node) => '\n\n' + Array.from(node.querySelector('ol').children, note =>
      `[^${note.id.replace(/^fn/, '')}]: ${markdown.turndown(note).replace(/\n/g, '\n    ')}`
    ).join('\n\n') + '\n\n',
  });
  markdown.addRule('nonDecimalList', {
    filter: node => node.nodeName === 'OL'
      && (node.hasAttribute('reversed') || (node.hasAttribute('type') && node.type !== '1')
        || Array.from(node.children).some(item => item.hasAttribute('value'))),
    replacement: (_content, node) => `\n\n${node.outerHTML}\n\n`,
  });
  markdown.addRule('table', {
    filter: 'table',
    replacement: (_content, table) => {
      const rows = Array.from(table.rows);
      if (!rows.length) return '';
      const header = Array.from(rows[0].cells);
      if (!header.length
        || table.querySelector('caption, [rowspan], [colspan], p, pre, ul, ol, blockquote')) {
        return `\n\n${table.outerHTML}\n\n`;
      }
      const row = cells => `| ${cells.join(' | ')} |`;
      const lines = rows.map(item => row(Array.from(item.cells, cell =>
        markdown.turndown(cell).replace(/\|/g, '\\|').replace(/\n/g, '<br>'))));
      if (!header.every(cell => cell.nodeName === 'TH')) {
        lines.unshift(row(header.map(() => '')));
      }
      const alignment = { left: ':---', center: ':---:', right: '---:' };
      lines.splice(1, 0, row(header.map(cell =>
        alignment[cell.style.textAlign || cell.getAttribute('align')] || '---')));
      return `\n\n${lines.join('\n')}\n\n`;
    },
  });

  function selectedContent(range) {
    const bounds = document.createRange();
    bounds.selectNodeContents(article);
    if (!range.intersectsNode(article)) return null;
    range = range.cloneRange();
    if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
      range.setStart(bounds.startContainer, bounds.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
      range.setEnd(bounds.endContainer, bounds.endOffset);
    }
    if (range.collapsed) return null;

    let fragment = range.cloneContents();
    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentElement;
    // cloneContents omits the shared ancestors that carry partial selections' formatting.
    while (ancestor && ancestor !== article) {
      const wrapper = ancestor.cloneNode(false);
      wrapper.append(fragment);
      fragment = wrapper;
      ancestor = ancestor.parentElement;
    }
    const container = document.createElement('div');
    container.append(fragment);

    const originalLists = Array.from(article.querySelectorAll('ol'))
      .filter(list => range.intersectsNode(list));
    container.querySelectorAll('ol').forEach((list, index) => {
      const original = originalLists[index];
      let number = original.hasAttribute('start') ? original.start
        : original.reversed ? original.querySelectorAll(':scope > li').length : 1;
      for (const item of original.children) {
        if (item.nodeName !== 'LI') continue;
        if (item.hasAttribute('value')) number = item.value;
        if (range.intersectsNode(item)) {
          list.start = number;
          break;
        }
        number += original.reversed ? -1 : 1;
      }
    });

    for (const code of container.querySelectorAll('pre > code')) {
      const language = [...code.classList, ...code.parentElement.classList]
        .find(name => !['sourceCode', 'numberSource', 'numberLines', 'lineAnchors'].includes(name));
      if (language && !language.startsWith('language-')) code.classList.add(`language-${language}`);
      for (const anchor of code.querySelectorAll('a[aria-hidden="true"]')) anchor.remove();
    }
    return container;
  }

  document.addEventListener('copy', event => {
    if (event.defaultPrevented || !event.clipboardData
      || document.activeElement?.closest('input, textarea, [contenteditable]')) return;
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) return;
    const fragments = [];
    for (let index = 0; index < selection.rangeCount; index++) {
      const fragment = selectedContent(selection.getRangeAt(index));
      if (fragment) fragments.push(fragment);
    }
    if (!fragments.length) return;
    event.clipboardData.setData('text/plain', fragments.map(node => markdown.turndown(node)).join('\n\n'));
    event.preventDefault();
  });
})();
