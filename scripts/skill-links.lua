function Link(link)
  local target = link.target:gsub("^%./", "")
  local name, suffix = target:match("^skills/([a-z0-9%-]+)/SKILL%.md(.*)$")
  if name and (suffix == "" or suffix:match("^[?#]")) then
    link.target = "/to/" .. name .. "/" .. suffix
  end
  return link
end

function Pandoc(document)
  local known_skills = {}
  for name in pandoc.utils.stringify(document.meta["skill-names"]):gmatch("%S+") do
    known_skills[name] = true
  end

  return document:walk({
    traverse = "topdown",
    Link = function(link)
      return Link(link), false
    end,
    RawInline = function(inline)
      if inline.format == "html" then
        local name = inline.text:match("^<([a-z0-9%-]+)>$")
        if known_skills[name] then
          return pandoc.Link(name, "/to/" .. name .. "/")
        end
      end
    end,
  })
end

return { { Pandoc = Pandoc } }
