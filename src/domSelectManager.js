// src/domSelectManager.js
import { StorageHelper } from "./storageHelper.js";

class DomSelectManager {
  constructor() {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) return; // No active tab found.
      // Check if DomSelector already exists in the tab
      const tab = tabs[0]
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => typeof window.DomSelector !== "undefined",
      });

      if (result?.result) {
        console.debug("DomSelector is already injected.");
        chrome.tabs.sendMessage(tab.id, { action: "toggleDomSelector" });
      } else {
        console.debug("Injecting content script...");
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/content.css"]
        });
      }
    });
    this.active = false;
  }

  toggle() {
    this.setActive(!this.active);
  }

  async setActive(active) {
    this.active = active;
    this.updateButtonState();
    if (!active) {
      await this.clearSelectedHTML();
    }
    this.sendToggleMessage();
  }

  updateButtonState() {
    const activateIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="m500-120-56-56 142-142-142-142 56-56 142 142 142-142 56 56-142 142 142 142-56 56-142-142-142 142Zm-220 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/>
      </svg>`;

    const deactivateIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="M440-120v-400h400v80H576l264 264-56 56-264-264v264h-80Zm-160 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/>
      </svg>`;

    const btn = document.getElementById("activateSelectionBtn");
    if (btn) {
      btn.innerHTML = this.active ? activateIcon : deactivateIcon;
      btn.classList.toggle("highlight", this.active);
    }
  }

  async clearSelectedHTML() {
    await StorageHelper.remove(["selectedHTML", "selectedCSS"], "local");
    const htmlContent = document.getElementById("html-content");
    if (htmlContent) {
      htmlContent.innerHTML = "";
    }
    console.debug("Selected HTML cleared.");
  }

  sendToggleMessage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleDomSelector",
        active: this.active
      });
    });
  }
}

export { DomSelectManager };