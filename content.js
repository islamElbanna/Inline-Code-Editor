let containers = {};
// Keyboard shortcut: Ctrl + Shift + E
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyU') {
    let focusedEle = document.activeElement;
    let container = containers[focusedEle.parentElement.id];
    if (container) {
      let editor = container.editor;
      let originalEle = document.getElementById(container.originalElement);
      focusedEle.parentElement.remove();
      originalEle.style.display = 'block';
      editor.destroy();
    } else if (focusedEle.tagName === 'TEXTAREA') {
      activateAceEditor(focusedEle);
    }
  }
});

function loadAce(callback) {
  if (window.ace) {
    callback();
    return;
  }
  loadFile('ace/ace.js', () => {
    // Load mode and theme
    loadFile('ace/ext-language_tools.js');
    loadFile('ace/ext-inline_autocomplete.js');
    loadMode('java');
    loadFile('ace/theme-github.js', callback);
  });
}

function activateAceEditor(textarea) {
  loadAce(() => {
    const value = textarea.value;
    const parent = textarea.parentElement;
    const editorDiv = document.createElement('div');

    editorDiv.style.width = textarea.offsetWidth + 'px';
    editorDiv.style.height = textarea.offsetHeight + 'px';
    editorDiv.style.border = '1px solid #ccc';

    textarea.style.display = 'none';
    if(textarea.id === "") {
      textarea.id = `ace-editor-${Date.now()}`;
      console.log("Setting ID for textarea:", textarea.id);
    }
    editorDiv.id = `ace-editor-${textarea.id}`;
    parent.insertBefore(editorDiv, textarea);

    ace.config.set('basePath', chrome.runtime.getURL('ace'));
    ace.require(["ace/ace", "ace/ext/language_tools", "ace/ext/inline_autocomplete"], function(ace) {
      console.log(ace);
      editor = ace.edit(editorDiv);
      editor.session.setMode("ace/mode/java");
      editor.setTheme("ace/theme/github");
      // enable inline autocompletion
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
        editor: editor,
        originalElement: textarea.id
      };
    });  
  });
}

function loadMode(modeName, callback) {
  loadFile(`ace/mode-${modeName}.js`, () => {
    console.log(`Loaded mode: ${modeName}`);
    loadFile(`ace/snippets/${modeName}.js`, callback);
  });
}

function loadFile(filePath, callback) {
  if (filePath) {
    ace.require(["ace/ace"], () => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(filePath);
      script.onload = () => {
        if(callback) {
          callback();
        }
      }
      document.head.appendChild(script);
    });
  }
}

//The context menu was clicked
chrome.runtime.onMessage.addListener(function(message)
{
    var code = "";
    if(message.changeMode !== undefined)
    {
      console.log("Changing mode to:", message.changeMode);
      let focusedEle = document.activeElement;
      let container = containers[focusedEle.parentElement.id];
      if (container) {
        let editor = container.editor;
        editor.session.setMode(`ace/mode/${message.changeMode}`);
        console.log(`Mode changed to:`, editor);
      }
    }
    else if(message.changeTheme !== undefined)
    {
        if(editorNode !== null)
        {
            aceEditor.setTheme(message.changeTheme);
        }
    }
    else if(message.toggleWordWrapping !== undefined)
    {
        if(editorNode !== null)
        {
            aceEditor.setWordWrapping(message.toggleWordWrapping)
        }
    }
    else
    {
        // if(editableArea === null)
        // {
        //     editableArea = document.getElementById(message.elementID);
        // }

        // //Assign ID to the original editable area if there's none
        // if(editableArea.id === "")
        // {
        //     editableArea.id = "_aceAnywhereOrigin";
        // }

        // //Create a wrapper for the Ace Editor
        // editorNode = document.createElement("div");
        // //Insert it just above the original editable area
        // editableArea.parentNode.insertBefore(editorNode, editableArea);
        // //Give it an ID
        // editorNode.setAttribute("id", "_aceAnywhereEditor");
        // //Set inital content from the original editable area
        // editorNode.innerHTML = editableArea.value.escapeHTMLEntities();
        // //Same height
        // editorNode.style.height = editableArea.offsetHeight+"px";
        // //Same width
        // editorNode.style.width = editableArea.offsetWidth+"px";
        // //Hide the original editable area
        // editableArea.style.display = "none";

        // //Import Ace from a CDN
        // var aceJS = document.createElement("script");
        // //aceJS.src = "//cdnjs.cloudflare.com/ajax/libs/ace/1.1.2/ace.js";
        // aceJS.src = "//cdnjs.cloudflare.com/ajax/libs/ace/1.1.3/ace.js";
        // aceJS.setAttribute("charset", "utf-8");
        // //When the script it finally loaded
        // aceJS.onload = function()
        // {
        //     var aceExtLanguageTools = document.createElement("script");
        //     aceExtLanguageTools.src = "//cdnjs.cloudflare.com/ajax/libs/ace/1.1.3/ext-language_tools.js";
        //     aceExtLanguageTools.onload = function()
        //     {
        //         document.head.appendChild(aceExtLanguageTools);
        //         /*
        //          * 1. Initialize Ace editor
        //          * 
        //          * 2. If TYPE_NORMAL keep changes on the original editable area,
        //          * so that changes can be saved by the application
        //          * 
        //          * 3. If TYPE_CPANEL, copy contents to the "CODEWINDOW.value" variable
        //          * only when the save button is pressed.
        //          */
        //         var loadAce = document.createElement("script");
        //         loadAce.innerHTML =
        //         '\
        //             var editableArea = document.getElementById("'+editableArea.id+'")\n\
        //             ace.require("ace/ext/language_tools");\n\
        //             var editor = ace.edit("_aceAnywhereEditor");\n\
        //             editor.setOptions(\n\
        //             {\n\
        //                 enableBasicAutocompletion: true\n\
        //             });\n\
        //             editor.getSession().setUseWorker(false);\n\
        //             editor.getSession().on("change", function(e)\n\
        //             {\n\
        //                 if(typeof CODEWINDOW === "undefined")\n\
        //                 {\n\
        //                     editableArea.innerHTML = editor.getSession().getValue();\n\
        //                 }\n\
        //             });\n\
        //             var sform_submit = document.getElementById("sform_submit");\n\
        //             if(sform_submit !== null)\n\
        //             {\n\
        //                 sform_submit.onclick = function()\n\
        //                 {\n\
        //                     CODEWINDOW.value = editor.getSession().getValue();\n\
        //                 }\n\
        //             }\n\
        //         ';

        //         document.head.appendChild(loadAce);
        //         aceEditor.setLanguage(message.language);
        //         aceEditor.setTheme(message.theme);
        //         aceEditor.setWordWrapping(message.wordWrapping);
        //     };
        
        //     document.head.appendChild(aceExtLanguageTools);
        // };

        // document.head.appendChild(aceJS);
    }
});
