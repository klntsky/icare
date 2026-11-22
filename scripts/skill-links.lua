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
    Strong = function(strong)
      if #strong.content == 1 and strong.content[1].t == "Str" then
        local name = strong.content[1].text
        if known_skills[name] then
          strong.content = { pandoc.Link(strong.content, "/to/" .. name .. "/") }
          return strong, false
        end
      end
    end,
  })
end

return { { Pandoc = Pandoc } }
