/*
 * Application types
 */
// cPanel's text editor
const TYPE_CPANEL = 0;
// Everything else
const TYPE_NORMAL = 1;

const aceModes = [
    "actionscript", "groovy", "matlab", "properties", "sql", "c_cpp", "html", "mysql", "protobuf", "sqlserver",
    "clojure", "java", "nginx", "puppet", "swift", "csharp", "javascript", "objectivec", "python", "text", "css",
    "json5", "pascal", "r", "typescript", "csv", "json", "perl", "ruby", "vue", "dockerfile", "jsp", "pgsql", "rust",
    "xml", "dot", "kotlin", "php", "scala", "yaml", "gitignore", "makefile", "plain_text", "sh", "golang", "markdown",
    "powershell", "soy_template"
];
const aceThemes = [
    "chrome", "dracula", "github", "xcode", "clouds", "eclipse", "github_light_default", "terminal",
    "dawn", "github_dark", "one_dark", "twilight"
];
const defaultLanguage = "javascript";
const defaultTheme = "github";
const defaultWordWrapping = false;

let editItcontextMenuID = null;
const aceModesFirstLetterContextmenuIDs = {};

// Ensure context menus are only created once
chrome.runtime.onInstalled.addListener(() => {
    createEditItContextMenu();
    createModesContextMenu();
    createThemesContextMenu();
    createPreferencesContextMenu();
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
    } else if (aceModes.includes(info.menuItemId)) {
        chrome.tabs.sendMessage(tab.id, { changeMode: info.menuItemId });
    } else if (aceThemes.includes(info.menuItemId)) {
        chrome.tabs.sendMessage(tab.id, { changeTheme: info.menuItemId });
    }
});

function editIt(tabID) {
    chrome.storage.local.get(["lastUsedLanguage", "lastUsedTheme", "wordWrapping"], (items) => {
        const language = typeof items.lastUsedLanguage === "string" ? items.lastUsedLanguage : defaultLanguage;
        const theme = typeof items.lastUsedTheme === "string" ? items.lastUsedTheme : defaultTheme;
        const wordWrapping = typeof items.wordWrapping === "boolean" ? items.wordWrapping : defaultWordWrapping;

        sendMessage(tabID, {
            edit: "it",
            language,
            theme,
            wordWrapping
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
                    id: language,
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
                    id: themeName,
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
