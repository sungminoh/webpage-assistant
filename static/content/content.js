// content/content.js
function getCssText(element) {
  const computedStyle = window.getComputedStyle(element);
  let cssText = "";
  for (let i = 0; i < computedStyle.length; i++) {
    const prop = computedStyle[i];
    cssText += `${prop}: ${computedStyle.getPropertyValue(prop)}; `;
  }
  return cssText;
}


function applyTheme() {
  chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt", "theme"], (data) => {
    const theme = data.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
  });
}

// 페이지가 로드될 때 테마 적용
applyTheme();

// 테마 변경 감지 및 적용
chrome.storage.onChanged.addListener((changes) => {
  if (changes.theme) {
    applyTheme();
  }
});

if (!window.DomSelector) {
  class DomSelector {
    constructor() {
      this.selectionActive = false;
      this.selectedElement = null;
      this.currentElement = null;
      this.createOverlay();
      this.createEscMenu();
      this.attachEventListeners();
      chrome.runtime.sendMessage({ action: "dom_selector_ready" });
    }

    reset() {
      this.selectionActive = false;
      this.clearBoundary(this.selectedElement);
      this.selectedElement = null;
      this.clearBoundary(this.currentElement);
      this.currentElement = null;
      this.overlay.style.display = "none";
      this.escMenu.style.display = "none";
      this.sendChageSelectedDomMessage(document.body);
    }

    handleKeydown(event) {
      if (event.key === "Escape") {
        console.log("ESC Pressed: Closing selection mode");
        this.reset();
      }
    }

    handleToggleMessage(message, sender, sendResponse) {
      if (message.action === "toggle_dom_selector") {
        this.selectionActive = !this.selectionActive;
        if (this.selectionActive) {
          this.overlay.style.display = "block";
          this.escMenu.style.display = "block";
        } else {
          this.reset();
        }
      }
    }

    handleMouseOver(event) {
      if (!this.selectionActive) return;
      if (this.currentElement && this.currentElement !== this.selectedElement) {
        this.clearBoundary(this.currentElement);
      }
      if (this.currentElement !== event.target && this.selectedElement !== event.target) {
        this.currentElement = event.target;
        this.markHoverBoundary(this.currentElement);
      }
    }

    sendChageSelectedDomMessage(element) {
      chrome.runtime.sendMessage({
        action: "change_selected_dom",
        active: this.selectionActive,
        url: window.location.href,
        html: element.outerHTML,
        css: getCssText(element),
      });
    }

    handleClick(event) {
      if (!this.selectionActive) return;
      event.preventDefault();

      if (this.selectedElement === event.target) {
        this.clearBoundary(this.selectedElement);
        this.selectedElement = null;
        let clonedBody = document.body.cloneNode(true);
        [this.overlay.id, this.escMenu.id].forEach(id => {
          let element = clonedBody.querySelector(`#${id}`);
          if (element) {
            element.remove();
          }
        });
        this.sendChageSelectedDomMessage(clonedBody);
      } else {
        if (this.selectedElement) {
          this.clearBoundary(this.selectedElement);
        }
        this.selectedElement = event.target;
        this.markSelectedBoundary(this.selectedElement);
        this.sendChageSelectedDomMessage(this.selectedElement);
      }
      chrome.runtime.sendMessage({ action: "open_popup" });
    }

    markSelectedBoundary(element) {
      element.removeAttribute("data-hovered");
      element.setAttribute("data-selected", "true");
    }

    markHoverBoundary(element) {
      element.setAttribute("data-hovered", "true");
    }

    clearBoundary(element) {
      if (element) {
        element.removeAttribute("data-selected");
        element.removeAttribute("data-hovered");
      }
    }

    createOverlay() {
      this.overlay = document.createElement("div");
      this.overlay.id = "dom-selector-overlay";
      Object.assign(this.overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: "9998",
        display: "none",
        pointerEvents: "none"
      });
      document.body.appendChild(this.overlay);
    }

    createEscMenu() {
      this.escMenu = document.createElement("div");
      this.escMenu.id = "dom-selector-esc-menu";
      this.escMenu.innerHTML = "🔍 Selection Mode Active – Press <b>ESC</b> to exit.";
      Object.assign(this.escMenu.style, {
        position: "fixed",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "10px 20px",
        background: "#222",
        color: "#fff",
        borderRadius: "8px",
        fontSize: "14px",
        zIndex: "9999",
        display: "none",
        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.3)"
      });
      document.body.appendChild(this.escMenu);
    }

    attachEventListeners() {
      chrome.runtime.onMessage.addListener(this.handleToggleMessage.bind(this));
      document.addEventListener("mouseover", this.handleMouseOver.bind(this));
      document.addEventListener("click", this.handleClick.bind(this));
      document.addEventListener("keydown", this.handleKeydown.bind(this));
    }
  }

  window.domSelector = new DomSelector();
}