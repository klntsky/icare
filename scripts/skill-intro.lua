function Pandoc(document)
  if not document.meta.name or not document.meta.description then
    return
  end

  local description = pandoc.utils.stringify(document.meta.description)
  if description == "" then
    return
  end

  document.blocks:insert(1, pandoc.Div(
    { pandoc.Para({ pandoc.Str(description) }) },
    pandoc.Attr("", { "skill-intro" })
  ))
  return document
end
