let editor;
// Keyboard shortcut: Ctrl + Shift + E
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyU') {
    let focusedEle = document.activeElement
    if (focusedEle.tagName === 'TEXTAREA' || focusedEle.tagName === 'DIV') {
      if (editor) {
        focusedEle.value = editor.getValue();
        editor.destroy();
        editor.container.remove();
        focusedEle.style.display = 'block';
      } else {  
        activateAceEditor(focusedEle);
      }
    }
  }
});

function loadAce(callback) {
  if (window.ace) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('ace/ace.js');
  script.onload = () => {
    // Load mode and theme
    const tools = document.createElement('script');
    tools.src = chrome.runtime.getURL('ace/ext-language_tools.js');
    document.head.appendChild(tools);

    const inline_autocomplete = document.createElement('script');
    inline_autocomplete.src = chrome.runtime.getURL('ace/ext-inline_autocomplete.js');
    document.head.appendChild(inline_autocomplete);

    const mode = document.createElement('script');
    mode.src = chrome.runtime.getURL('ace/mode-java.js');
    document.head.appendChild(mode);

    const theme = document.createElement('script');
    theme.src = chrome.runtime.getURL('ace/theme-github.js');
    theme.onload = callback;
    document.head.appendChild(theme);
  };
  document.head.appendChild(script);
}

function activateAceEditor(textarea) {
  if (textarea.dataset.aceActive) return; // prevent re-initialization
  console.log("enter activateAceEditor");

  loadAce(() => {
    const value = textarea.value;
    const parent = textarea.parentElement;
    const editorDiv = document.createElement('div');

    editorDiv.style.width = textarea.offsetWidth + 'px';
    editorDiv.style.height = textarea.offsetHeight + 'px';
    editorDiv.style.border = '1px solid #ccc';

    textarea.style.display = 'none';
    parent.insertBefore(editorDiv, textarea);

    ace.require(["ace/ace", "ace/ext/language_tools", "ace/ext/inline_autocomplete"], function(ace) {
      console.log(ace);
      editor = ace.edit(editorDiv);
      editor.session.setMode("ace/mode/java");
      editor.setTheme("ace/theme/github");
      // enable inline autocompletion
      editor.setOptions({
          enableBasicAutocompletion: false,
          enableInlineAutocompletion: true,
          enableSnippets: true,
          enableLiveAutocompletion: true,
          autoScrollEditorIntoView: true,
      });
      
      editor.session.on('change', () => {
        textarea.value = editor.getValue();
      });

      textarea.dataset.aceActive = 'true';
    });  
  });
}
