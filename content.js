class DomSelector {
    constructor() {
        this.selectionActive = false;
        this.selectedElement = null;
        this.currentElement = null;
        this.createOverlay();
        this.createEscMenu();
        // this.createPreviewBox();

        this.attachEventListeners();
    }

    reset() {
        this.selectionActive = false;
        this.clearBoundary(this.selectedElement);
        this.selectedElement = null;
        this.clearBoundary(this.currentElement);
        this.currentElement = null;
        chrome.runtime.sendMessage({ action: "click_target_dom", html: undefined });

        // Hide overlay, ESC menu, and preview box
        this.overlay.style.display = "none";
        this.escMenu.style.display = "none";
        // this.previewBox.style.display = "none";
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
            // this.previewBox.style.display = "none"; // Hide preview when deselected
        } else {
            if (this.selectedElement) {
                this.clearBoundary(this.selectedElement);
            }
            this.selectedElement = event.target;
            this.markSelectedBoundary(this.selectedElement);

            const position = {
                x: event.clientX + window.scrollX,
                y: event.clientY + window.scrollY
            };
            chrome.runtime.sendMessage({ action: "click_target_dom", html: event.target.outerHTML });
            // Request popup to open
            chrome.runtime.sendMessage({ action: "open_popup" });

            // Show selected element preview
            // this.updatePreviewBox(event.target);
        }
        // chrome.action.openPopup();
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

    /** Creates overlay to darken the background */
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
            pointerEvents: "none",
        });
        document.body.appendChild(this.overlay);
    }

    /** Creates ESC menu to guide users */
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
            boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.3)",
        });
        document.body.appendChild(this.escMenu);
    }

    // createPreviewBox() {
    //     this.previewBox = document.createElement("div");
    //     this.previewBox.style.position = "fixed";
    //     this.previewBox.style.right = "20px";
    //     this.previewBox.style.top = "60px";
    //     this.previewBox.style.width = "300px";
    //     this.previewBox.style.maxHeight = "400px";
    //     this.previewBox.style.overflowY = "auto";
    //     this.previewBox.style.background = "rgba(255, 255, 255, 0.95)";
    //     this.previewBox.style.color = "#333";
    //     this.previewBox.style.padding = "10px";
    //     this.previewBox.style.border = "1px solid #ccc";
    //     this.previewBox.style.borderRadius = "8px";
    //     this.previewBox.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
    //     this.previewBox.style.zIndex = "10000";
    //     this.previewBox.style.display = "none"; // Initially hidden

    //     // Add title
    //     this.previewBox.innerHTML = `<strong>Selected Element:</strong><pre id="preview-content" style="white-space: pre-wrap; word-wrap: break-word;"></pre>`;

    //     document.body.appendChild(this.previewBox);
    // }

    // updatePreviewBox(element) {
    //     document.getElementById("preview-content").textContent = element.outerHTML;
    //     this.previewBox.style.display = "block"; // Show preview
    // }
    /** Attaches event listeners */
    attachEventListeners() {
        chrome.runtime.onMessage.addListener(this.handleToggleMessage.bind(this));
        document.addEventListener("mouseover", this.handleMouseOver.bind(this));
        document.addEventListener("click", this.handleClick.bind(this));
        document.addEventListener("keydown", this.handleKeydown.bind(this));
    }
}

// Initialize DomSelector
const domSelector = new DomSelector();