const containers = {};
const defaultLanguage = "javascript";
const defaultTheme = "github";
const defaultWordWrapping = false;

// Keyboard shortcut: Ctrl + Shift + U
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyU') {
        handleEditorForActiveElement();
    }
});

function handleEditorForActiveElement() {
    const focusedEle = document.activeElement;
    if (!focusedEle) return;
    const parent = focusedEle.parentElement;
    if (!parent) return;

    const container = containers[parent.id];
    if (container) {
        const { editor, originalElement } = container;
        const originalEle = document.getElementById(originalElement);
        parent.remove();
        if (originalEle) originalEle.style.display = 'block';
        editor.destroy();
        delete containers[parent.id];
    } else if (focusedEle.tagName === 'TEXTAREA') {
        activateEditor(focusedEle);
    }
}

function loadEditor(callback) {
    if (window.editor) {
        callback();
        return;
    }
    loadFile('ace/ace.js', () => {
        loadFile('ace/ext-language_tools.js');
        loadFile('ace/ext-inline_autocomplete.js');
        window.editor = true;
    });
}

function activateEditor(textarea) {
    loadEditor(() => {
        const value = textarea.value;
        const parent = textarea.parentElement;
        if (!parent) return;

        const editorDiv = document.createElement('div');
        editorDiv.style.width = `${textarea.offsetWidth}px`;
        editorDiv.style.height = `${textarea.offsetHeight}px`;
        editorDiv.style.border = '1px solid #ccc';

        textarea.style.display = 'none';
        if (!textarea.id) {
            textarea.id = `ace-editor-${Date.now()}`;
        }
        editorDiv.id = `ace-editor-${textarea.id}`;
        parent.insertBefore(editorDiv, textarea);

        ace.config.set('basePath', chrome.runtime.getURL('ace'));
        ace.require([
            "ace/ace",
            "ace/ext/language_tools",
            "ace/ext/inline_autocomplete"
        ], function (aceInstance) {
            chrome.storage.local.get(["lastUsedLanguage", "lastUsedTheme", "wordWrapping"], function(items) {
                const language = items.lastUsedLanguage !== undefined ? items.lastUsedLanguage : defaultLanguage; 
                const theme = items.lastUsedTheme !== undefined ? items.lastUsedTheme : defaultTheme;
                const wordWrapping = items.wordWrapping !== undefined ? items.wordWrapping : defaultWordWrapping;
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
    });
}

function loadFile(filePath, callback) {
    if (!filePath) return;
    ace.require(["ace/ace"], () => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(filePath);
        script.onload = () => callback && callback();
        document.head.appendChild(script);
    });
}

// The context menu was clicked
chrome.runtime.onMessage.addListener((message) => {
    const focusedEle = document.activeElement;
    const parent = focusedEle.parentElement;
    if (!parent) return;

    const container = containers[parent.id];
    if (container){
      const { editor } = container;
      if (message.changeMode !== undefined) {
          editor.session.setMode(`ace/mode/${message.changeMode}`);
      }
      if (message.changeTheme !== undefined) {
          editor.setTheme(`ace/theme/${message.changeTheme}`);
      }
      if (message.toggleWordWrapping !== undefined) {
          editor.setWordWrapping(message.toggleWordWrapping);
      }
    } else if (message.edit === "it") {
      handleEditorForActiveElement();
    } else if (message.autoloadCurrentElement) {
        const url = window.location.href;
        chrome.storage.local.get("autoLoadingFields", function (items) {
            const autoLoadingFields = items["autoLoadingFields"] || {};
            if (autoLoadingFields[url] !== undefined && autoLoadingFields[url] !== false) {
                const fieldID = autoLoadingFields[url];
                if (document.getElementById(fieldID)) {
                    activateEditor(document.getElementById(fieldID));
                } else {
                    console.warn(`Element with ID ${fieldID} not found in the document.`);
                    delete autoLoadingFields[url];
                    chrome.storage.local.set({ "autoLoadingFields": autoLoadingFields });
                }
            }
        });
    }
});


//Autoload Editor for the saved URLs
chrome.storage.local.get("autoLoadingFields", function (items) {
    if (items["autoLoadingFields"] !== undefined) {
        var fieldID = items["autoLoadingFields"][window.location.href];
        if (fieldID !== undefined && fieldID !== false) {
            const element = document.getElementById(fieldID);
            if (element) {
                activateEditor(element);
            } else {
                console.warn(`Element with ID ${fieldID} not found in the document.`);
                delete items["autoLoadingFields"][window.location.href];
                chrome.storage.local.set({ "autoLoadingFields": items });
            }
        }
    }
});