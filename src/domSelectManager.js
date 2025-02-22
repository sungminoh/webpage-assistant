// src/domSelectManager.js
import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";
import { marked } from "../libs/marked.min.js";
import { TurndownService } from "../libs/turndown.js";

const turndownService = new TurndownService()


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

export async function getUrl(timeout) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return; // No active tab found.

  // Set a flag in the page's window object to prevent reinjection
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { window.__content_script_injected = true; }
  });
  const [{ result: url }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.location.href
  });
  return url;
}

class DomSelectManager {
  constructor(htmlBoxContainer) {
    injectScript();
    this.htmlBoxContainer = htmlBoxContainer;
    this.htmlContainer = this.htmlBoxContainer?.parentElement;
    this.htmlBox = htmlBoxContainer.querySelector(".html-box");
    this.markdownBox = htmlBoxContainer.querySelector(".markdown-box");
    this.leftButtons = this.htmlContainer.querySelector(".left-controls .html-box-buttons")
    this.rightButtons = this.htmlContainer.querySelector(".right-controls .html-box-buttons")
    this.originalHtml = null;
    this.textToCopy = "";
    this.active = false;
    this.setupCopyButton(); // Initialize copy button click event
    this.setupSwitchButton(); // Initialize copy button click event
    this.load();
  }

  setupCopyButton() {
    this.leftButtons.appendChild(UIHelper.createCopyButton("copySelectedBtn", () => this.textToCopy));
  }

  async setupSwitchButton() {
    const htmlModeButton = UIHelper.createSVGButton("button", "html-mode-button", UIHelper.getHtmlIcon(), activateHtmlMode.bind(this))
    const markdownModeButton = UIHelper.createSVGButton("button", "markdown-mode-button", UIHelper.getMarkdownIcon(), activateMarkdownMode.bind(this));

    function activateHtmlMode() {
      htmlModeButton.classList.add('active');
      markdownModeButton.classList.remove('active');
      StorageHelper.set({ htmlMode: "html" }, "sync").then(this.load.bind(this));
    }

    function activateMarkdownMode() {
      markdownModeButton.classList.add('active');
      htmlModeButton.classList.remove('active');
      StorageHelper.set({ htmlMode: "markdown" }, "sync").then(this.load.bind(this));
    }
    const { htmlMode } = await StorageHelper.get("htmlMode", "sync");
    if (htmlMode == "markdown") {
      markdownModeButton.classList.add('active');
    } else {
      htmlModeButton.classList.add('active');
    }
    this.rightButtons.appendChild(htmlModeButton);
    this.rightButtons.appendChild(markdownModeButton);
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
    const url = await getUrl();
    StorageHelper.update({ "domSelection": { [url]: { active: this.active } } }, "local");;
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
      btn.classList.toggle("active", this.active);
    }
  }

  async sendToggleMessage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    chrome.tabs.sendMessage(tab.id, {
      action: "toggle_dom_selector",
    });
  }

  load() {
    StorageHelper.get(["domSelection"], "local").then(async ({ domSelection }) => {
      const url = await getUrl()
      const { active, html, css } = domSelection[url] || {};
      const { htmlMode } = await StorageHelper.get("htmlMode", "sync")
      if (html?.trim()) {
        this.originalHtml = html;
        if (htmlMode === "markdown") {
          this.textToCopy = turndownService.turndown(html);
          this.markdownBox.innerHTML = marked.parse(this.textToCopy);
          this.markdownBox.style.display = "block";
          this.htmlBox.style.display = "none";
        } else {
          this.textToCopy = html;
          this.htmlBox.innerHTML = this.textToCopy;
          if (css?.trim()) {
            this.htmlBox.style.cssText = css;
          }
          this.htmlBox.style.display = "block";
          this.markdownBox.style.display = "none";
        }
        this.setActive(active);
      }
    });
  }
}

export { DomSelectManager };