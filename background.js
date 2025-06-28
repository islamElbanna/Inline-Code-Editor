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
    "chrome", "dracula", "github", "sqlserver", "xcode", "clouds", "eclipse", "github_light_default", "terminal",
    "dawn", "github_dark", "one_dark", "twilight"
];
const defaultLanguage = "java";
const defaultTheme = "github";
const defaultWordWrapping = false;

let aceItcontextMenuID = null;
const aceModesFirstLetterContextmenuIDs = {};
let fieldID = "";

init();

function init() {
    createAceItContextMenu();
    createModesContextMenu();
    createThemesContextMenu();
}

function aceIt(tabID, fieldID) {
    chrome.storage.local.get(["lastUsedLanguage", "lastUsedTheme", "wordWrapping"], (items) => {
        const language = items.lastUsedLanguage ?? defaultLanguage;
        const theme = items.lastUsedTheme ?? defaultTheme;
        const wordWrapping = items.wordWrapping ?? defaultWordWrapping;

        sendMessage(tabID, {
            ace: "it",
            language,
            theme,
            wordWrapping,
            elementID: fieldID
        });
    });
}

function sendMessage(tabID, properties) {
    chrome.tabs.sendMessage(tabID, properties);
}

function changeLanguage(tabID, languageName) {
    chrome.storage.local.set({ lastUsedLanguage: languageName });
    sendMessage(tabID, { changeMode: languageName });
}

function changeTheme(tabID, themeName) {
    chrome.storage.local.set({ lastUsedTheme: themeName });
    sendMessage(tabID, { changeTheme: themeName });
}

function toggleWordWrapping(tabID) {
    chrome.storage.local.get("wordWrapping", (items) => {
        const currentValue = items.wordWrapping ?? defaultWordWrapping;
        const wordWrapping = !currentValue;
        chrome.storage.local.set({ wordWrapping });
        sendMessage(tabID, { toggleWordWrapping: wordWrapping });
    });
}

function toggleAutoLoad(url) {
    isFieldAutoLoaded(url, (result, items) => {
        const obj = items["autoLoadingFields"] ?? {};
        obj[url] = result !== false ? false : fieldID;
        chrome.storage.local.set({ autoLoadingFields: obj });
    });
}

function isFieldAutoLoaded(url, callback) {
    chrome.storage.local.get("autoLoadingFields", (items) => {
        const loaded = !!(
            items["autoLoadingFields"] &&
            items["autoLoadingFields"][url] !== undefined &&
            items["autoLoadingFields"][url] !== false
        );
        callback(loaded, items);
    });
}

function createAceItContextMenu() {
    aceItcontextMenuID = chrome.contextMenus.create({
        id: "aceit",
        title: "Ace it!",
        contexts: ["editable"]
    });

    chrome.runtime.onMessage.addListener((message, sender) => {
        if (message.doWhat === "updateState") {
            let title = "Ace it!";
            if (message.type === "cpanel") {
                title = "Ace it! (cPanel detected)";
            }

            fieldID = message.elementID || "_aceAnywhereOrigin";

            isFieldAutoLoaded(message.url.href, (result) => {
                chrome.contextMenus.update("autoload", { checked: result });
            });

            chrome.contextMenus.update(aceItcontextMenuID, { title });
        } else if (message.doWhat === "aceIt") {
            aceIt(sender.tab.id, message.elementID);
        }
    });
}

function createModesContextMenu() {
    chrome.contextMenus.create({
        id: "acemodes",
        title: "Language",
        contexts: ["editable"]
    });

    aceModes.forEach((language) => {
        const firstLetter = language[0];
        let parentContextMenuID = aceModesFirstLetterContextmenuIDs[firstLetter];
        if (!parentContextMenuID) {
            parentContextMenuID = chrome.contextMenus.create({
                id: "first_letter_" + firstLetter,
                title: firstLetter.toUpperCase(),
                contexts: ["editable"],
                parentId: "acemodes"
            });
            aceModesFirstLetterContextmenuIDs[firstLetter] = parentContextMenuID;
        }
        chrome.contextMenus.create({
            id: language,
            title: language,
            contexts: ["editable"],
            parentId: parentContextMenuID
        });
    });
}

function createThemesContextMenu() {
    chrome.contextMenus.create({
        id: "acethemes",
        title: "Themes",
        contexts: ["editable"]
    });
    chrome.storage.local.get("lastUsedTheme", () => {
        aceThemes.forEach((themeName) => {
            chrome.contextMenus.create({
                id: themeName,
                title: themeName,
                checked: false,
                contexts: ["editable"],
                parentId: "acethemes"
            });
        });
    });
}

// Handle context menu clicks in MV3
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "aceit") {
        chrome.tabs.sendMessage(tab.id, { ace: "it" });
    } else if (info.menuItemId === "wordwrapping") {
        chrome.tabs.sendMessage(tab.id, { toggleWordWrapping: true });
    } else if (info.menuItemId === "acemodes" || info.menuItemId.startsWith("first_letter_")) {
        // Do nothing for parent menu
    } else if (aceModes.includes(info.menuItemId)) {
        chrome.tabs.sendMessage(tab.id, { changeMode: info.menuItemId });
    } else if (aceThemes.includes(info.menuItemId)) {
        chrome.tabs.sendMessage(tab.id, { changeTheme: info.menuItemId });
    }
});