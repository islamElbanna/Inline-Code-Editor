const AUTO_LOADING_FIELDS_KEY = "autoLoadingFields";
const LAST_USED_LANGUAGE_KEY = "lastUsedLanguage";
const LAST_USED_THEME_KEY = "lastUsedTheme";
const WORD_WRAPPING_KEY = "wordWrapping";
const containers = {};
const defaultLanguage = "javascript";
const defaultTheme = "github";
const defaultWordWrapping = false;

function handleEditorForActiveElement() {
    const focusedEle = document.activeElement;
    if (!focusedEle) return;

    // Check if we are inside an Ace editor (ace_content or ace_text-input)
    // We need to find the container div that we created.
    // The structure typically is: wrapper > .ace_editor > .ace_scroller > .ace_content > .ace_text-input (when focused)

    // Traverse up to find if we are in an editor container
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

function activateEditor(textarea) {
    if (window.ace) {
        initEditor(textarea);
    } else {
        console.error("Ace not loaded");
    }
}

function initEditor(textarea) {
    const value = textarea.value;
    const parent = textarea.parentElement;
    if (!parent) return;

    const editorDiv = document.createElement('div');
    editorDiv.style.position = 'absolute';
    editorDiv.style.width = `${textarea.offsetWidth}px`;
    editorDiv.style.height = `${textarea.offsetHeight}px`;
    editorDiv.style.marginTop = `${textarea.offsetTop}px`;
    editorDiv.style.marginLeft = `${textarea.offsetLeft}px`;
    editorDiv.style.border = '1px solid #ccc';

    textarea.style.display = 'none';
    if (!textarea.id) {
        textarea.id = `textarea-${Date.now()}`;
    }
    editorDiv.id = `ace-editor-${textarea.id}`;
    parent.insertBefore(editorDiv, textarea);

    ace.config.set('basePath', chrome.runtime.getURL('ace'));
    ace.require([
        "ace/ace",
        "ace/ext/language_tools",
        "ace/ext/inline_autocomplete"
    ], function (aceInstance) {
        chrome.storage.local.get([LAST_USED_LANGUAGE_KEY, LAST_USED_THEME_KEY, WORD_WRAPPING_KEY], function (items) {
            const language = items[LAST_USED_LANGUAGE_KEY] !== undefined ? items[LAST_USED_LANGUAGE_KEY] : defaultLanguage;
            const theme = items[LAST_USED_THEME_KEY] !== undefined ? items[LAST_USED_THEME_KEY] : defaultTheme;
            const wordWrapping = items[WORD_WRAPPING_KEY] !== undefined ? items[WORD_WRAPPING_KEY] : defaultWordWrapping;
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
                editor.session.setMode(`ace/mode/${message.changeMode}`);
                chrome.storage.local.set({ [LAST_USED_LANGUAGE_KEY]: message.changeMode });
                console.log("Saved changeMode as: ", message.changeMode);
            } else if (message.changeTheme !== undefined) {
                editor.setTheme(`ace/theme/${message.changeTheme}`);
                chrome.storage.local.set({ [LAST_USED_THEME_KEY]: message.changeTheme });
                console.log("Saved changeTheme as: ", message.changeTheme);
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