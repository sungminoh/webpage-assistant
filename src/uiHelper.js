// src/uiHelper.js
export class UIHelper {
  static createElement(tag, className = "", innerHTML = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
  }

  static createSVGButton(className, svgContent, onClick = null) {
    const button = UIHelper.createElement("div", className, svgContent);
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  static createDragHandle() {
    return UIHelper.createSVGButton("drag-handle", `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368">
        <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
      </svg>`);
  }

  static createPromptText(text) {
    const promptText = UIHelper.createElement("div", "prompt-text");
    promptText.textContent = text;
    return promptText;
  }

  static createRemoveButton(onClick) {
    return UIHelper.createSVGButton("remove-btn", `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368"><path d="M200-440v-80h560v80H200Z"/></svg>
      `, (event) => {
      event.stopPropagation();
      onClick();
    });
  }

  static createDeleteButton(onClick) {
    return UIHelper.createSVGButton("remove-btn", `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
      `, (event) => {
      event.stopPropagation();
      onClick();
    });
  }

  static createCopyButton(text) {
    const btn = UIHelper.createSVGButton(
      "copy-btn",
      UIHelper.getCopyIcon(),
      async (e) => {
        await navigator.clipboard.writeText(text);
        btn.innerHTML = UIHelper.getSuccessIcon();
        setTimeout(() => {
          btn.innerHTML = UIHelper.getCopyIcon();
        }, 2000);
      }
    );
    return btn;
  }

  static getCopyIcon() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>
      `;
  }

  static getSuccessIcon() {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px">
          <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
        </svg>
      `;
  }
}