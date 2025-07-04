const containers = {};

// Keyboard shortcut: Ctrl + Shift + U
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyU') {
        handleAceForActiveElement();
    }
});

function handleAceForActiveElement() {
    const focusedEle = document.activeElement;
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
        activateAceEditor(focusedEle);
    }
}

function loadAce(callback) {
    if (window.ace) {
        callback();
        return;
    }
    loadFile('ace/ace.js', () => {
        loadFile('ace/ext-language_tools.js');
        loadFile('ace/ext-inline_autocomplete.js');
        loadFile('ace/mode-javascript.js');
        loadFile('ace/theme-github.js', callback);
    });
}

function activateAceEditor(textarea) {
    loadAce(() => {
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
            const editor = aceInstance.edit(editorDiv);
            editor.session.setMode("ace/mode/javascript");
            editor.setTheme("ace/theme/github");
            editor.setOptions({
                enableBasicAutocompletion: true,
                enableInlineAutocompletion: true,
                enableSnippets: true,
                enableLiveAutocompletion: true,
                autoScrollEditorIntoView: true,
            });
            editor.session.setUseWorker(true);
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
    } else if (message.ace === "it") {
      handleAceForActiveElement();
    }
});
