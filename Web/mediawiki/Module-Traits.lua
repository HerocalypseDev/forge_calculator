local p = {}

local STYLES = "Template:Traits/styles.css"
local TYPE_ORDER = { "Armor", "Weapon", "Pickaxe", "Race" }
local NO_CAP = "No Cap"
local CAP_LABEL = "Cap"
local CAPS_HEADING = "Caps"
local MAX_CAPS = 4
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
    return mw.ustring.lower(traitType or "")
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
        item:wikitext(string.format("[[File:%s|44px|link=%s|alt=%s]]", source.image, source.name, source.name))
    else
        item:addClass("trait-source-text"):wikitext(string.format("[[%s]]", source.name))
    end
end

local function capParts(cap)
    if type(cap) == "table" then
        return cap.value, cap.label
    end
    local label, value = mw.ustring.match(tostring(cap or ""), "^%s*(.-)%s*=%s*(.-)%s*$")
    if label then
        return value, label
    end
    return cap, nil
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
    card:tag("div"):addClass("trait-card-icon"):wikitext(icon(trait, 64))
    card:tag("div"):addClass("trait-card-name"):wikitext(trait.name)
end

local function renderDetail(area, trait, sources)
    local detail = area:tag("div"):addClass("trait-detail"):attr("data-trait", trait.slug)

    detail:tag("div")
        :addClass("trait-detail-art")
        :tag("div"):addClass("trait-detail-icon"):wikitext(icon(trait, 140))

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

    local caps = detail:tag("div"):addClass("trait-detail-caps")
    caps:tag("div"):addClass("trait-detail-caps-label"):wikitext(CAPS_HEADING)
    local stats = caps:tag("div"):addClass("trait-detail-stats")
    local shownCaps = 0
    for _, cap in ipairs(trait.caps) do
        if shownCaps == MAX_CAPS then
            break
        end
        local value, label = capParts(cap)
        if not isBlank(value) then
            renderStat(stats, value, isBlank(label) and CAP_LABEL or label)
            shownCaps = shownCaps + 1
        end
    end
    if shownCaps == 0 then
        renderStat(stats, NO_CAP, CAP_LABEL)
        shownCaps = 1
    end
    stats:addClass("has-" .. shownCaps)

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
    local traits, counts, needSources = {}, {}, false
    for _, raw in ipairs(data.traits) do
        local trait = {
            name = raw.name,
            type = raw.type or "",
            image = raw.image,
            color = raw.color,
            description = raw.description,
            note = raw.note,
            caps = raw.caps or {},
            foundOn = raw.foundOn or {},
        }
        trait.slug = mw.uri.anchorEncode(trait.name)
        trait.filter = filterKey(trait.type)
        trait.hasImage = fileExists(trait.image)
        if trait.foundOn[1] then
            needSources = true
        end
        counts[trait.filter] = (counts[trait.filter] or 0) + 1
        table.insert(traits, trait)
    end
    return traits, counts, needSources
end

function p.browser(frame)
    local traits, counts, needSources = prepare(mw.loadData("Module:Traits/Data"))
    local sources = needSources and loadSources() or {}

    local root = mw.html.create("div")
        :addClass("trait-browser")
        :addClass("pf-outer")
        :attr("data-placeholder", "Search traits...")

    local list = root:tag("div"):addClass("trait-browser-list")
    list:tag("div"):addClass("pf-searchbox"):tag("div"):addClass("pf-search-target")

    local filterBar = list:tag("div"):addClass("trait-filter-bar")
    filterBar:tag("span"):addClass("trait-filter-arrow is-left is-hidden"):attr("title", "Scroll left"):wikitext("&#8249;")
    local filters = filterBar:tag("div"):addClass("trait-filters")
    filterBar:tag("span"):addClass("trait-filter-arrow is-right is-hidden"):attr("title", "Scroll right"):wikitext("&#8250;")
    renderFilter(filters, "all", "All", #traits, true)
    for _, label in ipairs(TYPE_ORDER) do
        local key = filterKey(label)
        renderFilter(filters, key, label, counts[key] or 0, false)
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
