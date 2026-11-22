local site_url
local page_url
local notes
local render_blocks
local absolute_url

local function escape(text)
  return text:gsub('&', '&amp;'):gsub('<', '&lt;'):gsub('>', '&gt;'):gsub('"', '&quot;')
end

local function syntax(text)
  return '<span class="markdown-syntax">' .. escape(text) .. '</span>'
end

local function source(block)
  block = block:walk({
    Link = function(link)
      link.target = absolute_url(link.target)
      return link
    end,
  })
  return pandoc.write(pandoc.Pandoc({ block }),
    'markdown+pipe_tables+fenced_code_blocks+backtick_code_blocks',
    { wrap_text = 'none' }):gsub('\n+$', '')
end

local function inline_source(inline)
  return source(pandoc.Plain({ inline }))
end

absolute_url = function(target)
  if target:match('^[%a][%w+.-]*:') then return target end
  if target:sub(1, 2) == '//' then return 'https:' .. target end
  if target:sub(1, 1) == '#' or target:sub(1, 1) == '?' then
    return page_url .. target
  end
  local path, suffix = target:match('^([^?#]*)(.*)$')
  if path:sub(1, 1) ~= '/' then
    path = page_url:sub(#site_url + 1) .. path
  end
  return site_url .. pandoc.path.normalize(path) .. suffix
end

local function render_inlines(inlines)
  local output = {}
  local formats = {
    Strong = { 'strong', '**' }, Emph = { 'em', '*' },
    Strikeout = { 'del', '~~' }, Superscript = { 'sup', '^' },
    Subscript = { 'sub', '~' },
  }
  for _, inline in ipairs(inlines) do
    local kind = inline.t
    local format = formats[kind]
    local html
    if format then
      html = '<' .. format[1] .. '>' .. syntax(format[2])
        .. render_inlines(inline.content) .. syntax(format[2])
        .. '</' .. format[1] .. '>'
    elseif kind == 'Space' then
      html = ' '
    elseif kind == 'SoftBreak' then
      html = '\n'
    elseif kind == 'LineBreak' then
      html = syntax('  ') .. '<br>\n'
    elseif kind == 'Link' then
      local target = absolute_url(inline.target)
      local title = inline.title ~= ''
        and ' "' .. inline.title:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"' or ''
      local destination = target:gsub('<', '%%3C'):gsub('>', '%%3E')
      html = '<a href="' .. escape(target) .. '">' .. syntax('[')
        .. render_inlines(inline.content) .. syntax('](<' .. destination .. '>' .. title .. ')') .. '</a>'
    elseif kind == 'Image' then
      local image = inline:clone()
      image.src = absolute_url(image.src)
      html = '<img src="' .. escape(image.src) .. '" alt="' .. escape(pandoc.utils.stringify(image.caption))
        .. '">' .. syntax(inline_source(image))
    elseif kind == 'Code' then
      html = '<code>' .. escape(inline_source(inline)) .. '</code>'
    elseif kind == 'Note' then
      notes[#notes + 1] = inline.content
      html = syntax('[^' .. #notes .. ']')
    else
      html = escape(inline_source(inline))
    end
    output[#output + 1] = html
  end
  return table.concat(output)
end

local function prefixed(html, prefix, first_prefix)
  first_prefix = first_prefix or prefix
  local first = first_prefix ~= '' and syntax(first_prefix) or ''
  local following = prefix ~= '' and syntax(prefix) or ''
  return first .. html:gsub('\n', '\n' .. following)
end

local function render_block(block, prefix, first_prefix)
  first_prefix = first_prefix or prefix
  local kind = block.t
  if kind == 'Para' or kind == 'Plain' or kind == 'Header' then
    local tag = kind == 'Header' and 'h' .. block.level or 'p'
    local id = kind == 'Header' and ' id="' .. escape(block.identifier) .. '"' or ''
    local marker = kind == 'Header' and string.rep('#', block.level) .. ' ' or ''
    local html = (marker ~= '' and syntax(marker) or '') .. render_inlines(block.content)
    return '<' .. tag .. id .. '>' .. prefixed(html, prefix, first_prefix) .. '</' .. tag .. '>\n\n'
  elseif kind == 'Div' and block.classes:includes('skill-intro') then
    return '<div class="skill-intro">' .. render_blocks(block.content, prefix) .. '</div>'
  elseif kind == 'BulletList' or kind == 'OrderedList' then
    local tag = kind == 'BulletList' and 'ul' or 'ol'
    local output = { '<' .. tag .. ' class="markdown-list">' }
    for index, item in ipairs(block.content) do
      local marker = kind == 'BulletList' and '- ' or tostring(block.start + index - 1) .. '. '
      output[#output + 1] = '<li>' .. render_blocks(item, prefix .. string.rep(' ', #marker), prefix .. marker) .. '</li>'
    end
    output[#output + 1] = '</' .. tag .. '>\n\n'
    return table.concat(output)
  elseif kind == 'BlockQuote' then
    return '<blockquote>' .. render_blocks(block.content, prefix .. '> ') .. '</blockquote>\n\n'
  elseif kind == 'HorizontalRule' then
    return '<p class="markdown-rule">' .. syntax(first_prefix .. '---') .. '</p>\n\n'
  end
  return '<pre class="markdown-source">' .. prefixed(escape(source(block)), prefix, first_prefix) .. '</pre>\n\n'
end

render_blocks = function(blocks, prefix, first_prefix)
  local output = {}
  for index, block in ipairs(blocks) do
    output[#output + 1] = render_block(block, prefix or '', index == 1 and first_prefix or nil)
  end
  return table.concat(output)
end

function Pandoc(document)
  site_url = pandoc.utils.stringify(document.meta['site-url'])
  page_url = pandoc.utils.stringify(document.meta['page-url'])
  notes = {}
  local html = render_blocks(document.blocks, '')
  local index = 1
  while notes[index] do
    html = html .. render_blocks(notes[index], '    ', '[^' .. index .. ']: ')
    index = index + 1
  end
  return pandoc.Pandoc({ pandoc.RawBlock('html', html) }, document.meta)
end
