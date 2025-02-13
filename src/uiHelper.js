export class UIHelper {
  /**
   * Creates an SVG button with a given id, initial SVG markup, and click handler.
   * @param {string} id - The id to assign to the button.
   * @param {string} svgHTML - The initial SVG markup.
   * @param {function} onClickHandler - The click event handler.
   * @returns {HTMLButtonElement} - The created button element.
   */
  static createSVGButton(tag, id, svgHTML, onClickHandler = null) {
    const element = document.createElement(tag);
    element.id = id;
    element.classList.add("icon-btn");
    element.innerHTML = svgHTML;
    if (onClickHandler) element.addEventListener("click", onClickHandler);
    return element;
  }

  /**
   * Creates a copy button that copies the given text to the clipboard,
   * then shows a success animation.
   * @param {string} text - The text to copy.
   */
  static createCopyButton(text) {
    const btn = UIHelper.createSVGButton(
      "button",
      "copy-btn",
      UIHelper.getCopyIcon(),
      async (e) => {
        // Add click animation
        btn.classList.add("button-clicked");
        try {
          await navigator.clipboard.writeText(text);
          btn.innerHTML = UIHelper.getSuccessIcon();
          btn.classList.add("button-success");
        } catch (error) {
          btn.innerHTML = UIHelper.getErrorIcon();
          btn.classList.add("button-error");
        }
        setTimeout(() => {
          btn.classList.remove("button-clicked", "button-success", "button-error");
          btn.innerHTML = UIHelper.getCopyIcon();
        }, 1000);
      }
    );
    return btn;
  }

  /**
   * Creates a delete button with a simple deletion animation.
   */
  static createDeleteButton() {
    const btn = UIHelper.createSVGButton(
      "button",
      "delete-btn",
      UIHelper.getDeleteIcon(),
      (e) => {
        btn.classList.add("button-clicked", "button-delete");
        // Caller should handle removal of the parent element.
        setTimeout(() => {
          btn.classList.remove("button-clicked", "button-delete");
        }, 500);
      }
    );
    return btn;
  }

  static createDragHandle() {
    return UIHelper.createSVGButton(
      "div", "drag-handle", `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368">
        <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
      </svg>`);
  }

  /**
   * Creates a reload button that shows a brief rotation animation.
   */
  static createReloadButton(onClickHandler) {
    const btn = UIHelper.createSVGButton(
      "button",
      "reload-btn",
      UIHelper.getReloadIcon(),
      (e) => {
        btn.classList.add("button-clicked", "button-reload");
        if (typeof onClickHandler === "function") onClickHandler(e);
        setTimeout(() => {
          btn.classList.remove("button-clicked", "button-reload");
          btn.innerHTML = UIHelper.getReloadIcon();
        }, 800);
      }
    );
    return btn;
  }

  /* ---- Icon Generators ---- */
  static getCopyIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960" fill="#5f6368">
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
      </svg>
    `;
  }

  static getSuccessIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960" fill="#5f6368">
        <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
      </svg>
    `;
  }

  static getErrorIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960" fill="#e06c75">
        <path d="M480-80q-80 0-136-56t-56-136q0-80 56-136t136-56q80 0 136 56t56 136q0 80-56 136t-136 56ZM400-320h160v-80H400v80ZM400-480h160v-80H400v80Z"/>
      </svg>
    `;
  }

  static getDeleteIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960" fill="#5f6368">
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h240q33 0 56.5 23.5T680-800v480q0 33-23.5 56.5T600-240H360Zm0-80h240v-480H360v480ZM240-80q-33 0-56.5-23.5T160-160v-80h80v560h560v80H240Z"/>
      </svg>
    `;
  }

  static getReloadIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960" fill="#5f6368">
        <path d="M480-120q-105 0-178.5-73.5T228-372q0-105 73.5-178.5T480-624q105 0 178.5 73.5T732-372q0 105-73.5 178.5T480-120Zm0-80q79 0 134-55t55-134q0-79-55-134T480-480q-79 0-134 55t-55 134q0 79 55 134t134 55ZM480-320v-160l80 80-80 80Z"/>
      </svg>
    `;
  }
}