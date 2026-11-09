local p = {}

local STYLES = "Template:Traits/styles.css"
local TYPE_ORDER = { "Armor", "Weapon", "Pickaxe", "Race" }
local NO_CAP = "No Cap"
local NO_DESCRIPTION = "No description yet."
local SOURCE_MODULES = {
    { module = "Module:Ore/Data", list = "ores", name = "name" },
    { module = "Module:Runes/Data", list = "runes", name = "name" },
    { module = "Module:Races/Data", name = "title" },
}

local function isBlank(value)
    return value == nil or mw.text.trim(tostring(value)) == ""
end

local function filterKey(traitType)
    local base = mw.ustring.gsub(traitType or "", "^Extra ", "")
    return mw.ustring.lower(base)
end

local function rgba(hex, alpha)
    local r, g, b = tostring(hex or ""):match("^#?(%x%x)(%x%x)(%x%x)$")
    if not r then
        r, g, b = "9a", "9a", "9a"
    end
    return string.format("rgba(%d, %d, %d, %s)", tonumber(r, 16), tonumber(g, 16), tonumber(b, 16), alpha)
end

local function initials(name)
    local letters = {}
    for word in mw.ustring.gmatch(name, "%w+") do
        table.insert(letters, mw.ustring.upper(mw.ustring.sub(word, 1, 1)))
        if #letters == 2 then
            break
        end
    end
    return table.concat(letters)
end

local function fileExists(image)
    if isBlank(image) then
        return false
    end
    local title = mw.title.new(image, "File")
    if title == nil then
        return false
    end
    local ok, exists = pcall(function()
        return title.file.exists
    end)
    return not ok or exists
end

local function icon(trait, size)
    if trait.hasImage then
        return string.format("[[File:%s|%dpx|link=|alt=%s]]", trait.image, size, trait.name)
    end
    return tostring(mw.html.create("span"):addClass("trait-icon-missing"):wikitext(initials(trait.name)))
end

local function loadSources()
    local index = {}
    for _, source in ipairs(SOURCE_MODULES) do
        local ok, data = pcall(mw.loadData, source.module)
        local entries = ok and (source.list and data[source.list] or data) or nil
        if entries then
            for _, entry in ipairs(entries) do
                local name = entry[source.name]
                if name and not index[mw.ustring.lower(name)] then
                    index[mw.ustring.lower(name)] = { name = name, image = entry.image }
                end
            end
        end
    end
    return index
end

local function renderSource(list, entry, sources)
    local source = sources[mw.ustring.lower(entry)] or { name = entry }
    local item = list:tag("span"):addClass("trait-source"):attr("title", source.name)
    if source.image then
        item:wikitext(string.format("[[File:%s|40px|link=%s|alt=%s]]", source.image, source.name, source.name))
    else
        item:addClass("trait-source-text"):wikitext(string.format("[[%s]]", source.name))
    end
end

local function renderStat(stats, value, label)
    local stat = stats:tag("div"):addClass("trait-stat")
    stat:tag("div"):addClass("trait-stat-value"):wikitext(value)
    stat:tag("div"):addClass("trait-stat-label"):wikitext(label)
end

local function renderCard(grid, trait)
    local card = grid:tag("div")
        :addClass("trait-card")
        :addClass("filter-" .. trait.filter)
        :attr("data-trait", trait.slug)
        :attr("data-name", mw.ustring.lower(trait.name))
        :attr("title", trait.name)
    card:tag("div"):addClass("trait-card-icon"):wikitext(icon(trait, 52))
    card:tag("div"):addClass("trait-card-name"):wikitext(trait.name)
end

local function renderDetail(area, trait, sources)
    local detail = area:tag("div"):addClass("trait-detail"):attr("data-trait", trait.slug)

    detail:tag("div")
        :addClass("trait-detail-art")
        :css("background", string.format(
            "radial-gradient(circle at 50%% 45%%, %s 0%%, %s 40%%, rgba(0, 0, 0, 0) 72%%)",
            rgba(trait.color, 0.42), rgba(trait.color, 0.1)))
        :tag("div"):addClass("trait-detail-icon"):wikitext(icon(trait, 150))

    local info = detail:tag("div"):addClass("trait-detail-info")
    info:tag("div"):addClass("trait-detail-kicker"):wikitext(trait.type .. " Trait")
    info:tag("div"):addClass("trait-detail-name"):wikitext(trait.name)
    info:tag("div"):addClass("trait-detail-rule"):css("background", isBlank(trait.color) and "#F9B65B" or trait.color)
    local description = info:tag("div"):addClass("trait-detail-description")
    if isBlank(trait.description) then
        description:addClass("is-empty"):wikitext(NO_DESCRIPTION)
    else
        description:newline():wikitext(trait.description)
    end
    if not isBlank(trait.note) then
        info:tag("div"):addClass("trait-detail-note"):wikitext(trait.note)
    end

    local stats = detail:tag("div"):addClass("trait-detail-stats")
    renderStat(stats, isBlank(trait.cap) and NO_CAP or trait.cap, "Cap")
    if type(trait.extra) == "table" and not isBlank(trait.extra.value) then
        renderStat(stats, trait.extra.value, trait.extra.label or "")
    end

    local found = detail:tag("div"):addClass("trait-detail-found")
    found:tag("div"):addClass("trait-detail-found-label"):wikitext("Found On")
    local list = found:tag("div"):addClass("trait-detail-found-list")
    local hasSource = false
    for _, entry in ipairs(trait.foundOn) do
        renderSource(list, entry, sources)
        hasSource = true
    end
    if not hasSource then
        list:tag("span"):addClass("trait-detail-found-empty"):wikitext("&mdash;")
    end
end

local function renderFilter(filters, key, label, count, active)
    local button = filters:tag("span"):addClass("pf-btn"):attr("data-filter", key)
    if active then
        button:addClass("active")
    end
    button:wikitext(label)
    button:tag("span"):addClass("trait-filter-count"):wikitext(count)
end

local function prepare(data)
    local traits, counts, order, needSources = {}, {}, {}, false
    for _, raw in ipairs(data.traits) do
        local trait = {
            name = raw.name,
            type = raw.type or "",
            image = raw.image,
            color = raw.color,
            description = raw.description,
            note = raw.note,
            cap = raw.cap,
            extra = raw.extra,
            foundOn = raw.foundOn or {},
        }
        trait.slug = mw.uri.anchorEncode(trait.name)
        trait.filter = filterKey(trait.type)
        trait.hasImage = fileExists(trait.image)
        if trait.foundOn[1] then
            needSources = true
        end
        if not counts[trait.filter] then
            counts[trait.filter] = 0
            table.insert(order, trait.filter)
        end
        counts[trait.filter] = counts[trait.filter] + 1
        table.insert(traits, trait)
    end
    return traits, counts, order, needSources
end

function p.browser(frame)
    local traits, counts, order, needSources = prepare(mw.loadData("Module:Traits/Data"))
    local sources = needSources and loadSources() or {}

    local root = mw.html.create("div")
        :addClass("trait-browser")
        :addClass("pf-outer")
        :attr("data-placeholder", "Search traits...")

    local list = root:tag("div"):addClass("trait-browser-list")
    list:tag("div"):addClass("pf-searchbox"):tag("div"):addClass("pf-search-target")

    local filters = list:tag("div"):addClass("trait-filters")
    renderFilter(filters, "all", "All", #traits, true)
    local shown = {}
    for _, label in ipairs(TYPE_ORDER) do
        local key = mw.ustring.lower(label)
        if counts[key] then
            renderFilter(filters, key, label, counts[key], false)
            shown[key] = true
        end
    end
    for _, key in ipairs(order) do
        if not shown[key] and key ~= "" then
            renderFilter(filters, key, mw.language.getContentLanguage():ucfirst(key), counts[key], false)
        end
    end

    local grid = list:tag("div"):addClass("trait-grid")
    for _, trait in ipairs(traits) do
        renderCard(grid, trait)
    end

    local area = root:tag("div"):addClass("trait-detail-area")
    area:tag("span"):addClass("trait-detail-close"):attr("title", "Close"):wikitext("&times;")
    for _, trait in ipairs(traits) do
        renderDetail(area, trait, sources)
    end

    return frame:extensionTag("templatestyles", "", { src = STYLES }) .. tostring(root)
end

return p
