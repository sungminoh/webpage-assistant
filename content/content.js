// content/content.js
class DomSelector {
    constructor() {
      this.selectionActive = false;
      this.selectedElement = null;
      this.currentElement = null;
      this.createOverlay();
      this.createEscMenu();
      this.attachEventListeners();
    }
  
    reset() {
      this.selectionActive = false;
      this.clearBoundary(this.selectedElement);
      this.selectedElement = null;
      this.clearBoundary(this.currentElement);
      this.currentElement = null;
      chrome.runtime.sendMessage({ action: "click_target_dom", html: undefined });
      this.overlay.style.display = "none";
      this.escMenu.style.display = "none";
    }
  
    handleKeydown(event) {
      if (event.key === "Escape") {
        console.log("ESC Pressed: Closing selection mode");
        this.reset();
      }
    }
  
    handleToggleMessage(message, sender, sendResponse) {
      if (message.action === "toggleDomSelector") {
        this.selectionActive = message.active;
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
  
    handleClick(event) {
      if (!this.selectionActive) return;
      event.preventDefault();
  
      if (this.selectedElement === event.target) {
        this.clearBoundary(this.selectedElement);
        this.selectedElement = null;
      } else {
        if (this.selectedElement) {
          this.clearBoundary(this.selectedElement);
        }
        this.selectedElement = event.target;
        this.markSelectedBoundary(this.selectedElement);
        chrome.runtime.sendMessage({ action: "click_target_dom", html: event.target.outerHTML });
        chrome.runtime.sendMessage({ action: "open_popup" });
      }
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
  
  const domSelector = new DomSelector();