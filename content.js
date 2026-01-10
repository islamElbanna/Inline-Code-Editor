const AUTO_LOADING_FIELDS_KEY = "autoLoadingFields";
const LAST_USED_LANGUAGE_KEY = "lastUsedLanguage";
const LAST_USED_THEME_KEY = "lastUsedTheme";
const WORD_WRAPPING_KEY = "wordWrapping";
const containers = {};
const defaultLanguage = "javascript";
const defaultTheme = "github";
const defaultWordWrapping = false;


function loadScript(path) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ command: "loadScript", script: path }, (response) => {
            if (response && response.success) {
                resolve();
            } else {
                reject(new Error(response?.error || "Unknown error loading script " + path));
            }
        });
    });
}


function handleEditorForActiveElement() {
    const focusedEle = document.activeElement;
    if (!focusedEle) return;

    // Check if we are inside an Ace editor
    let current = focusedEle;
    let containerId = null;

    while (current && current !== document.body) {
        if (containers[current.id]) {
            containerId = current.id;
            break;
        }
        current = current.parentElement;
    }

    if (containerId) {
        const { editor, originalElement } = containers[containerId];
        const originalEle = document.getElementById(originalElement);
        const containerDiv = document.getElementById(containerId);

        if (containerDiv) containerDiv.remove();
        if (originalEle) originalEle.style.display = 'block';
        if (editor) editor.destroy();
        delete containers[containerId];
    } else if (focusedEle.tagName === 'TEXTAREA' || focusedEle.tagName === 'DIV') {
        activateEditor(focusedEle);
    }
}

async function activateEditor(textarea) {
    if (!window.ace) {
        try {
            await loadScript("ace/ace.js");
            // Load common extensions
            await loadScript("ace/ext-language_tools.js");
            await loadScript("ace/ext-inline_autocomplete.js");
        } catch (e) {
            console.error("Failed to load Ace Editor:", e);
            return;
        }
    }
    initEditor(textarea);
}

function initEditor(textarea) {
    const value = textarea.value;
    const parent = textarea.parentElement;
    if (!parent) return;

    const editorDiv = document.createElement('div');
    // Using getBoundingClientRect for absolute positioning relative to viewport/page
    // But since we are injecting into parent, simpler logic:
    // Match the size of the original textarea
    const rect = textarea.getBoundingClientRect();

    // Note: The original logic replaced the element *in flow* but used absolute positioning.
    // If we want to overlay, we need correct positioning.
    // Original logic: parent.insertBefore(editorDiv, textarea);
    // This puts it in the DOM. Absolute positioning takes it out of flow.
    // If textarea is display:none, parent might collapse if it was the only child.
    // Better: keep it simple to original logic for now, just fix lazy loading. 
    // I will stick to original positioning logic to minimize regression risk unless I see it broken.

    editorDiv.style.position = 'absolute';
    editorDiv.style.width = `${textarea.offsetWidth}px`;
    editorDiv.style.height = `${textarea.offsetHeight}px`;
    editorDiv.style.marginTop = `${textarea.offsetTop}px`;
    editorDiv.style.marginLeft = `${textarea.offsetLeft}px`;
    editorDiv.style.border = '1px solid #ccc';
    editorDiv.style.zIndex = '10000'; // Ensure it's on top if absolute

    textarea.style.display = 'none';
    if (!textarea.id) {
        textarea.id = `textarea-${Date.now()}`;
    }
    editorDiv.id = `ace-editor-${textarea.id}`;
    parent.insertBefore(editorDiv, textarea);

    // Prevent Ace from trying to lazy-load files using document.createElement ("Main World" issue)
    ace.config.set('basePath', '');
    ace.config.set('modePath', '');
    ace.config.set('themePath', '');
    // Worker path MUST be set for syntax validation to work
    ace.config.set('workerPath', chrome.runtime.getURL('ace'));
    // Force loading worker from URL (extension resource) instead of Blob
    ace.config.set('loadWorkerFromBlob', true);

    // Ensure require works.
    ace.require([
        "ace/ace",
        "ace/ext/language_tools",
        "ace/ext/inline_autocomplete"
    ], function (aceInstance) {
        chrome.storage.local.get([LAST_USED_LANGUAGE_KEY, LAST_USED_THEME_KEY, WORD_WRAPPING_KEY], async function (items) {
            const language = items[LAST_USED_LANGUAGE_KEY] !== undefined ? items[LAST_USED_LANGUAGE_KEY] : defaultLanguage;
            const theme = items[LAST_USED_THEME_KEY] !== undefined ? items[LAST_USED_THEME_KEY] : defaultTheme;
            const wordWrapping = items[WORD_WRAPPING_KEY] !== undefined ? items[WORD_WRAPPING_KEY] : defaultWordWrapping;

            // Load mode, theme, and snippets now
            try {
                await loadScript(`ace/mode-${language}.js`);
                await loadScript(`ace/theme-${theme}.js`);
                // Start loading snippets but don't fail if they don't exist (most standard languages have them)
                await loadScript(`ace/snippets/${language}.js`);
            } catch (err) {
                // Snippet might fail if it doesn't exist, which is fine, but mode/theme failure is bad.
                // We log but continue, allowing editor to at least try to render.
                console.warn("Failed to load mode/theme/snippet:", err);
            }

            const editor = aceInstance.edit(editorDiv);
            editor.session.setMode("ace/mode/" + language);
            editor.setTheme("ace/theme/" + theme);
            editor.setOptions({
                enableBasicAutocompletion: true,
                enableInlineAutocompletion: true,
                enableSnippets: true,
                enableLiveAutocompletion: true,
                autoScrollEditorIntoView: true,
            });
            // Enable worker for syntax validation
            editor.session.setUseWorker(true);
            editor.session.setUseWrapMode(wordWrapping);
            editor.session.addMarker(editor.selection.toOrientedRange(), "ace_selected_word", "text");
            editor.session.on('change', () => {
                textarea.value = editor.getValue();
                textarea.textContent = textarea.value;
            });
            editor.setValue(value, -1); // -1 to not move cursor
            containers[editorDiv.id] = {
                editor,
                originalElement: textarea.id
            };
        });
    });
}

// The context menu was clicked
chrome.runtime.onMessage.addListener((message) => {
    const focusedEle = document.activeElement;
    if (!focusedEle) return;
    const parent = focusedEle.parentElement;
    if (!parent) return;

    if (message.autoloadCurrentElement !== undefined) {
        // Save the current element for autoloading
        console.log("Autoloading current element");
        const url = window.location.href;
        let fieldID = focusedEle.id;
        const container = containers[parent.id];
        if (container) {
            // If the editor is already active, save the ID of the original element
            fieldID = container.originalElement;
        }
        if (fieldID === undefined || fieldID === false) return;

        chrome.storage.local.get(AUTO_LOADING_FIELDS_KEY, function (items) {
            const autoLoadingFields = items[AUTO_LOADING_FIELDS_KEY] || {};
            autoLoadingFields[url] = autoLoadingFields[url] === fieldID ? false : fieldID; // Toggle the field ID
            console.log("Saving current element to autoLoadingFields:", autoLoadingFields);
            chrome.storage.local.set({ [AUTO_LOADING_FIELDS_KEY]: autoLoadingFields });
        });
    } else if (message.edit === "it") {
        handleEditorForActiveElement();
    } else {
        const container = containers[parent.id];
        if (container) {
            const { editor } = container;
            if (message.changeMode !== undefined) {
                // Load mode and snippets
                const modePromise = loadScript(`ace/mode-${message.changeMode}.js`);
                // Assume snippet matches mode name
                const snippetPromise = loadScript(`ace/snippets/${message.changeMode}.js`).catch(() => { });

                Promise.all([modePromise, snippetPromise]).then(() => {
                    editor.session.setMode(`ace/mode/${message.changeMode}`);
                    chrome.storage.local.set({ [LAST_USED_LANGUAGE_KEY]: message.changeMode });
                    console.log("Saved changeMode as: ", message.changeMode);
                }).catch(e => console.error("Failed to load mode/snippet:", e));
            } else if (message.changeTheme !== undefined) {
                loadScript(`ace/theme-${message.changeTheme}.js`).then(() => {
                    editor.setTheme(`ace/theme/${message.changeTheme}`);
                    chrome.storage.local.set({ [LAST_USED_THEME_KEY]: message.changeTheme });
                    console.log("Saved changeTheme as: ", message.changeTheme);
                }).catch(e => console.error("Failed to load theme:", e));
            } else if (message.toggleWordWrapping !== undefined) {
                editor.setWordWrapping(message.toggleWordWrapping);
                chrome.storage.local.set({ [WORD_WRAPPING_KEY]: message.toggleWordWrapping });
                console.log("Saved toggleWordWrapping as: ", message.toggleWordWrapping);
            }
        }
    }
});


//Autoload Editor for the saved URLs
chrome.storage.local.get(AUTO_LOADING_FIELDS_KEY, function (items) {
    if (items[AUTO_LOADING_FIELDS_KEY] !== undefined) {
        var fieldID = items[AUTO_LOADING_FIELDS_KEY][window.location.href];
        if (fieldID !== undefined && fieldID !== false) {
            console.log("Autoloading field with ID:", fieldID);
            const element = document.getElementById(fieldID);
            if (element) {
                console.log("Found element with ID:", fieldID);
                activateEditor(element);
            } else {
                console.warn(`Element with ID ${fieldID} not found in the document.`);
                delete items[AUTO_LOADING_FIELDS_KEY][window.location.href];
                chrome.storage.local.set({ [AUTO_LOADING_FIELDS_KEY]: items[AUTO_LOADING_FIELDS_KEY] });
            }
        }
    }
});