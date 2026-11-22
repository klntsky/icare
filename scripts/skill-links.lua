function Link(link)
  local target = link.target:gsub("^%./", "")
  local name, suffix = target:match("^skills/([a-z0-9%-]+)/SKILL%.md(.*)$")
  if name and (suffix == "" or suffix:match("^[?#]")) then
    link.target = "/to/" .. name .. "/" .. suffix
  end
  return link
end
