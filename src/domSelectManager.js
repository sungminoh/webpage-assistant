// src/domSelectManager.js
import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";

export async function injectScript(timeout) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return; // No active tab found.

  // Check if the script is already injected
  const [{ result: isInjected }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!window.__content_script_injected
  });

  if (!isInjected) {
    console.debug(`[${new Date().toISOString()}] Injecting content script...`);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/content.js"],
    })
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content/content.css"]
    })
    // Set a flag in the page's window object to prevent reinjection
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { window.__content_script_injected = true; }
    });
  }

  return new Promise((resolve, reject) => {
    if (isInjected) resolve();

    const listener = (message, sender) => {
      if (message.action === "dom_selector_ready") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    // Set a timeout to avoid waiting indefinitely.
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error("Timeout. DomSelector is not ready."));
    }, timeout);
  });
}

class DomSelectManager {
  constructor(htmlBox) {
    injectScript();
    this.htmlBox = htmlBox;
    this.htmlContainer = htmlBox?.parentElement;
    this.buttons = this.htmlContainer.querySelector(".html-box-buttons")
    this.active = false;
    this.setupCopyHtmlButton(); // Initialize copy button click event
    this.load();
  }

  setupCopyHtmlButton() {
    this.buttons.appendChild(UIHelper.createCopyButton("copyHtmlBtn", () => this.htmlBox?.innerHTML));
  }

  toggle() {
    this.setActive(!this.active);
    this.sendToggleMessage();
    if (this.active) {
      window.close();
    }
  }

  async setActive(active) {
    this.active = active;
    await StorageHelper.set({ domSelectionActive: active }, "local");
    this.updateButtonState();
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

  sendToggleMessage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggle_dom_selector",
      });
    });
  }

  load() {
    StorageHelper.get(["domSelectionActive", "selectedHTML", "selectedCSS"], "local").then(({ domSelectionActive, selectedHTML, selectedCSS }) => {
      if (selectedHTML?.trim()) {
        if (this.htmlBox) {
          this.htmlBox.innerHTML = selectedHTML;
          if (selectedCSS?.trim()) {
            this.htmlBox.style.cssText = selectedCSS;
          }
        }
        this.setActive(domSelectionActive);
      }
    });
  }
}

export { DomSelectManager };