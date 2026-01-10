/*
 * Application types
 */
// cPanel's text editor
const TYPE_CPANEL = 0;
// Everything else
const TYPE_NORMAL = 1;

const aceModes = [
    "abap", "abc", "actionscript", "ada", "alda", "apache_conf", "apex", "applescript", "aql", "asciidoc", "asl",
    "assembly_arm32", "assembly_x86", "astro", "autohotkey", "basic", "batchfile", "bibtex", "c9search", "c_cpp",
    "cirru", "clojure", "clue", "cobol", "coffee", "coldfusion", "crystal", "csharp", "csound_document",
    "csound_orchestra", "csound_score", "csp", "css", "csv", "curly", "cuttlefish", "d", "dart", "diff", "django",
    "dockerfile", "dot", "drools", "edifact", "eiffel", "ejs", "elixir", "elm", "erlang", "flix", "forth", "fortran",
    "fsharp", "fsl", "ftl", "gcode", "gherkin", "gitignore", "glsl", "gobstones", "golang", "graphqlschema", "groovy",
    "haml", "handlebars", "haskell", "haskell_cabal", "haxe", "hjson", "html", "html_elixir", "html_ruby", "ini", "io",
    "ion", "jack", "jade", "java", "javascript", "jexl", "json", "json5", "jsoniq", "jsp", "jssm", "jsx", "julia",
    "kotlin", "latex", "latte", "less", "liquid", "lisp", "livescript", "logiql", "logtalk", "lsl", "lua", "luapage",
    "lucene", "makefile", "markdown", "mask", "matlab", "maze", "mediawiki", "mel", "mips", "mixal", "mushcode", "mysql",
    "nasal", "nginx", "nim", "nix", "nsis", "nunjucks", "objectivec", "ocaml", "odin", "partiql", "pascal", "perl",
    "pgsql", "php", "php_laravel_blade", "pig", "plain_text", "plsql", "powershell", "praat", "prisma", "prolog",
    "properties", "protobuf", "prql", "puppet", "python", "qml", "r", "raku", "razor", "rdoc", "red", "redshift",
    "rhtml", "robot", "rst", "ruby", "rust", "sac", "sass", "scad", "scala", "scheme", "scrypt", "scss", "sh", "sjs",
    "slim", "smarty", "smithy", "snippets", "soy_template", "space", "sparql", "sql", "sqlserver", "stylus", "svg",
    "swift", "tcl", "terraform", "tex", "text", "textile", "toml", "tsv", "tsx", "turtle", "twig", "typescript", "vala",
    "vbscript", "velocity", "verilog", "vhdl", "visualforce", "vue", "wollok", "xml", "xquery", "yaml", "zeek", "zig"
];
const aceThemes = [
    "ambiance", "chaos", "chrome", "cloud9_day", "cloud9_night", "cloud9_night_low_color", "cloud_editor",
    "cloud_editor_dark", "clouds", "clouds_midnight", "cobalt", "crimson_editor", "dawn", "dracula", "dreamweaver",
    "eclipse", "github", "github_dark", "github_light_default", "gob", "gruvbox", "gruvbox_dark_hard",
    "gruvbox_light_hard", "idle_fingers", "iplastic", "katzenmilch", "kr_theme", "kuroir", "merbivore", "merbivore_soft",
    "mono_industrial", "monokai", "nord_dark", "one_dark", "pastel_on_dark", "solarized_dark", "solarized_light",
    "sqlserver", "terminal", "textmate", "tomorrow", "tomorrow_night", "tomorrow_night_blue", "tomorrow_night_bright",
    "tomorrow_night_eighties", "twilight", "vibrant_ink", "xcode"
];
const defaultLanguage = "javascript";
const defaultTheme = "github";
const defaultWordWrapping = false;

let editItcontextMenuID = null;
const aceModesFirstLetterContextmenuIDs = {};

// Ensure context menus are only created once
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        createEditItContextMenu();
        createModesContextMenu();
        createThemesContextMenu();
        createPreferencesContextMenu();
    });
});

// Handle context menu clicks in MV3
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) {
        console.warn("No tab information available for context menu click.");
        return;
    }
    if (info.menuItemId === "editit") {
        editIt(tab.id);
    } else if (info.menuItemId === "wordwrapping") {
        toggleWordWrapping(tab.id);
    } else if (info.menuItemId === "autoload") {
        chrome.tabs.sendMessage(tab.id, { url: tab.url, autoloadCurrentElement: true });
    } else if (info.menuItemId === "acemodes" || info.menuItemId.startsWith("first_letter_")) {
        // Do nothing for parent menu
    } else if (info.menuItemId.startsWith("mode:")) {
        const mode = info.menuItemId.split(":")[1];
        chrome.tabs.sendMessage(tab.id, { changeMode: mode });
    } else if (info.menuItemId.startsWith("theme:")) {
        const theme = info.menuItemId.split(":")[1];
        chrome.tabs.sendMessage(tab.id, { changeTheme: theme });
    }
});

// Handle toggle editor command
chrome.commands.onCommand.addListener((command) => {
    console.log("Command: " + command);
    if (command === "toggle-editor") {
        getCurrentTab((tab) => {
            editIt(tab.id);
        });
    }
});

// Listen for script loading requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "loadScript" && sender.tab) {
        const scriptPath = message.script;
        chrome.scripting.executeScript({
            target: {
                tabId: sender.tab.id,
                frameIds: [sender.frameId]
            },
            files: [scriptPath]
        }).then(() => {
            sendResponse({ success: true });
        }).catch((err) => {
            console.error(`Failed to inject ${scriptPath}:`, err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open for async response
    }
});

function getCurrentTab(callback) {
    let queryOptions = { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, ([tab]) => {
        if (chrome.runtime.lastError)
            console.error(chrome.runtime.lastError);
        // `tab` will either be a `tabs.Tab` instance or `undefined`.
        callback(tab);
    });
}

function editIt(tabID) {
    // Inject Ace if not already there, then send "edit: it"
    // We can just inject ace.js every time; if it's already there, it re-executes but that's generally okay,
    // OR content script can request it.
    // Better approach: Send message. If content script says "Ace not found", then inject it.
    // Even better: Content script handles the Logic. Background just says "Edit it".
    // If content script needs ace, it sends "loadScript" to background.

    chrome.storage.local.get(["lastUsedLanguage", "lastUsedTheme", "wordWrapping"], (items) => {
        const language = typeof items.lastUsedLanguage === "string" ? items.lastUsedLanguage : defaultLanguage;
        const theme = typeof items.lastUsedTheme === "string" ? items.lastUsedTheme : defaultTheme;
        const wordWrapping = typeof items.wordWrapping === "boolean" ? items.wordWrapping : defaultWordWrapping;

        // Try sending message first
        chrome.tabs.sendMessage(tabID, {
            edit: "it",
            language,
            theme,
            wordWrapping
        }, (response) => {
            if (chrome.runtime.lastError) {
                // Content script might not be ready or page not reload. 
                // In MV3, if we removed all scripts, we rely on content.js being there.
                console.warn("Could not send message to tab: ", chrome.runtime.lastError.message);
            }
        });
    });
}

function sendMessage(tabID, properties) {
    try {
        chrome.tabs.sendMessage(tabID, properties, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Error sending message to tab:", chrome.runtime.lastError.message);
            }
        });
    } catch (e) {
        console.error("Exception sending message to tab:", e);
    }
}

function changeLanguage(tabID, languageName) {
    chrome.storage.local.set({ lastUsedLanguage: languageName }, () => {
        if (chrome.runtime.lastError) {
            console.warn("Error saving lastUsedLanguage:", chrome.runtime.lastError.message);
        }
        sendMessage(tabID, { changeMode: languageName });
    });
}

function changeTheme(tabID, themeName) {
    chrome.storage.local.set({ lastUsedTheme: themeName }, () => {
        if (chrome.runtime.lastError) {
            console.warn("Error saving lastUsedTheme:", chrome.runtime.lastError.message);
        }
        sendMessage(tabID, { changeTheme: themeName });
    });
}

function toggleWordWrapping(tabID) {
    chrome.storage.local.get("wordWrapping", (items) => {
        const currentValue = typeof items.wordWrapping === "boolean" ? items.wordWrapping : defaultWordWrapping;
        const wordWrapping = !currentValue;
        chrome.storage.local.set({ wordWrapping }, () => {
            if (chrome.runtime.lastError) {
                console.warn("Error saving wordWrapping:", chrome.runtime.lastError.message);
            }
            sendMessage(tabID, { toggleWordWrapping: wordWrapping });
        });
    });
}

function createEditItContextMenu() {
    try {
        editItcontextMenuID = chrome.contextMenus.create({
            id: "editit",
            title: "Edit it!",
            contexts: ["editable"]
        });
    } catch (e) {
        console.error("Error creating EditIt context menu:", e);
    }
}

function createModesContextMenu() {
    try {
        chrome.contextMenus.create({
            id: "acemodes",
            title: "Language",
            contexts: ["editable"]
        });

        chrome.storage.local.get("lastUsedLanguage", (items) => {
            aceModes.forEach((language) => {
                const firstLetter = language[0];
                let parentContextMenuID = aceModesFirstLetterContextmenuIDs[firstLetter];
                if (!parentContextMenuID) {
                    parentContextMenuID = chrome.contextMenus.create({
                        id: "first_letter_" + firstLetter,
                        title: firstLetter.toUpperCase(),
                        contexts: ["editable"],
                        checked: typeof items.lastUsedLanguage === "string" && items.lastUsedLanguage.startsWith(firstLetter),
                        parentId: "acemodes"
                    });
                    aceModesFirstLetterContextmenuIDs[firstLetter] = parentContextMenuID;
                }
                chrome.contextMenus.create({
                    id: "mode:" + language,
                    title: language,
                    contexts: ["editable"],
                    checked: items.lastUsedLanguage === language,
                    parentId: parentContextMenuID
                });
            });
        });
    } catch (e) {
        console.error("Error creating Modes context menu:", e);
    }
}

function createThemesContextMenu() {
    try {
        chrome.contextMenus.create({
            id: "acethemes",
            title: "Themes",
            contexts: ["editable"]
        });
        chrome.storage.local.get("lastUsedTheme", (items) => {
            aceThemes.forEach((themeName) => {
                chrome.contextMenus.create({
                    id: "theme:" + themeName,
                    title: themeName,
                    checked: items.lastUsedTheme === themeName,
                    contexts: ["editable"],
                    parentId: "acethemes"
                });
            });
        });
    } catch (e) {
        console.error("Error creating Themes context menu:", e);
    }
}

function createPreferencesContextMenu() {
    try {
        chrome.contextMenus.create({
            id: "preferences",
            title: "Preferences",
            contexts: ["editable"],
        });

        chrome.contextMenus.create({
            id: "wordwrapping",
            title: "Toggle Word Wrapping",
            contexts: ["editable"],
            parentId: "preferences"
        });

        chrome.contextMenus.create({
            id: "autoload",
            title: "Auto load Editor on this Element",
            contexts: ["editable"],
            parentId: "preferences",
            type: "checkbox"
        });
    } catch (e) {
        console.error("Error creating Preferences context menu:", e);
    }
}
