/*
 * Application types
 */
//cPanel's text editor
let TYPE_CPANEL = 0;
//Everything else
let TYPE_NORMAL = 1;

let aceModes = ["actionscript", "groovy", "matlab", "properties", "sql", "c_cpp", "html", "mysql", "protobuf", "sqlserver", "clojure", "java", "nginx", "puppet", "swift", "csharp", "javascript", "objectivec", "python", "text", "css", "json5", "pascal", "r", "typescript", "csv", "json", "perl", "ruby", "vue", "dockerfile", "jsp", "pgsql", "rust", "xml", "dot", "kotlin", "php", "scala", "yaml", "gitignore", "makefile", "plain_text", "sh", "golang", "markdown", "powershell", "soy_template"];
let aceThemes = ["chrome", "dracula", "github", "sqlserver", "xcode", "clouds", "eclipse", "github_light_default", "terminal", "dawn", "github_dark", "one_dark", "twilight",];
let defaultLanguage = "java";
let defaultTheme = "github";
let defaultWordWrapping = false;
let aceItcontextMenuID = null;
let aceModesFirstLetterContextmenuIDs = [];
let fieldID = "";

createAceItContextMenu();
createModesContextMenu();
createThemesContextMenu();
createPreferencesContextMenu();

function aceIt(tabID, fieldID)
{
    var language = defaultLanguage;
    var theme = defaultTheme;
    var wordWrapping = defaultWordWrapping;
    
    chrome.storage.local.get(["lastUsedLanguage", "lastUsedTheme", "wordWrapping"], function(items)
    {
        if(items.lastUsedLanguage !== undefined)
        {
            language = items.lastUsedLanguage;
        }
    
        if(items.lastUsedTheme !== undefined)
        {
            theme = items.lastUsedTheme;
        }
    
        if(items.wordWrapping !== undefined)
        {
            wordWrapping = items.wordWrapping;
        }
    
        sendMessage(tabID, {"ace": "it", "language": language, "theme": theme, "wordWrapping": wordWrapping, "elementID": fieldID});
    });
}

function sendMessage(tabID, properties)
{
    chrome.tabs.sendMessage(tabID, properties);
}

function changeLanguage (tabID, languageName)
{
    chrome.storage.local.set({lastUsedLanguage: languageName});
    sendMessage(tabID, {"changeMode":languageName});
};

function changeTheme (tabID, themeName)
{
    chrome.storage.local.set({lastUsedTheme: themeName});
    sendMessage(tabID, {changeTheme: themeName});
}

function toggleWordWrapping(tabID)
{
    var currentValue = defaultWordWrapping;
    chrome.storage.local.get("wordWrapping", function(items)
    {
        if(items.wordWrapping !== undefined)
        {
            currentValue = items.wordWrapping;
        }

        var wordWrapping = !currentValue;
        chrome.storage.local.set({wordWrapping: wordWrapping});
        sendMessage(tabID, {toggleWordWrapping: wordWrapping});
    });
}

function toggleAutoLoad(url)
{
    isFieldAutoLoaded(url, function(result, items)
    {
        var obj = {};
        if(items["autoLoadingFields"] !== undefined)
        {
            obj = items["autoLoadingFields"];
        }
        
        obj[url] = fieldID;
        if(result !== false)
        {
            obj[url] = false;    
        }
        chrome.storage.local.set({autoLoadingFields: obj});
    });
}

function isFieldAutoLoaded(url, callback)
{
    chrome.storage.local.get("autoLoadingFields", function(items)
    {
        callback(items["autoLoadingFields"]!== undefined && items["autoLoadingFields"][url] !== undefined && items["autoLoadingFields"][url] !== false, items);
    });
}

function createAceItContextMenu()
{
    aceItcontextMenuID = chrome.contextMenus.create(
    {
        "id": "aceit",
        "title": "Ace it!",
        "contexts": ["editable"]
    });

    chrome.runtime.onMessage.addListener(function(message, sender)
    {
        console.log("Received message: ", message);
        if(message.doWhat === "updateState")
        {
            var title = "Ace it!";
            if(message.type === "cpanel")
            {
                title = "Ace it! (cPanel detected)";
            }
        
            fieldID = message.elementID;
            if(fieldID === "")
            {
                fieldID = "_aceAnywhereOrigin";
            }
        
            var autoLoadState = false;
            isFieldAutoLoaded(message.url.href, function(result, items)
            {
                autoLoadState = result;
                chrome.contextMenus.update("autoload", {checked: autoLoadState});
            });
            
            chrome.contextMenus.update(aceItcontextMenuID, {title: title});
        }
        else if(message.doWhat === "aceIt")
        {

            aceIt(sender.tab.id, message.elementID);
        }
    });
}

function createModesContextMenu()
{
    chrome.contextMenus.create(
    {
        "id": "acemodes",
        "title": "Language",
        "contexts": ["editable"]
    });

    for(var i=0; i<aceModes.length; i++)
    {
        var language = aceModes[i];
        var firstLetter = language[0];
        var parentContextMenuID = aceModesFirstLetterContextmenuIDs[firstLetter];
        if(parentContextMenuID === undefined)
        {
            parentContextMenuID = chrome.contextMenus.create(
            {
                "id": "first_letter_"+firstLetter,
                "title": firstLetter.toUpperCase(),
                "contexts": ["editable"],
                "parentId": "acemodes"
            });
            aceModesFirstLetterContextmenuIDs[firstLetter] = parentContextMenuID;
        }
        chrome.contextMenus.create(
        {
            "id": language,
            "title": language,
            "contexts": ["editable"],
            "parentId": parentContextMenuID
        });
    }
}
function createThemesContextMenu()
{
    chrome.contextMenus.create(
    {
        "id": "acethemes",
        "title": "Themes",
        "contexts": ["editable"]
    });
    chrome.storage.local.get("lastUsedTheme", function(items)
    {        
        for(var i=0; i<aceThemes.length; i++)
        {
            var themeName = aceThemes[i];
            chrome.contextMenus.create(
            {
                "id": themeName,
                "title": themeName,
                "checked": false,
                "contexts": ["editable"],
                "parentId": "acethemes"
            });
        }
    });
}
function createPreferencesContextMenu()
{
    chrome.contextMenus.create(
    {
        "id": "preferences",
        "title": "Preferences",
        "contexts": ["editable"]
    });
    chrome.contextMenus.create(
    {
        "id": "wordwrapping",
        "title": "Toggle Word Wrapping",
        "contexts": ["editable"],
        "parentId": "preferences"
    });
    chrome.contextMenus.create(
    {
        "id": "autoload",
        "title": "Auto load Ace on this URL",
        "contexts": ["editable"],
        "parentId": "preferences",
        "type": "checkbox"
    });
}

// Add this at the end of the file to handle context menu clicks in MV3
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if(info.menuItemId === "aceit") {
        console.log("Ace it clicked for tab: ", info);
        chrome.tabs.sendMessage(tab.id, {ace: "it"});
    } else if(info.menuItemId === "wordwrapping") {
        chrome.tabs.sendMessage(tab.id, {toggleWordWrapping: true});
    } else if(info.menuItemId === "autoload") {
        chrome.tabs.sendMessage(tab.id, {toggleAutoLoad: true, url: info.pageUrl});
    } else if(info.menuItemId === "acemodes" || info.menuItemId.startsWith("first_letter_")) {
        // Do nothing for parent menu
    } else if(aceModes.includes(info.menuItemId)) {
        chrome.tabs.sendMessage(tab.id, {changeMode: info.menuItemId});
    } else if(aceThemes.includes(info.menuItemId)) {
        chrome.tabs.sendMessage(tab.id, {changeTheme: info.menuItemId});
    }
});