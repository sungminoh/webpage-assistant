// src/contentProcessor.js
import { StorageHelper } from "./storageHelper.js";
import { chatManager } from "./chatManager.js";
import { ModelManager } from "./modelManager.js";

class ContentProcessor {
  static async submitPrompt(prompt) {
    if (!prompt) return;

    const selectedModel = ModelManager.getSelectedModel();
    if (!selectedModel) return;

    if (!(await this.validateApiKey(selectedModel))) return;

    // const chatManager = new ChatManager(document.getElementById("chat"))
    chatManager.addMessage("User", prompt);
    chatManager.saveChatHistory();
    chatManager.showPlaceholder();

    function processPageContent(prompt, model, selectedHtml) {
      const ALLOWED_ATTRS = { a: ["href"], img: ["src", "alt"], iframe: ["src"] };

      function cleanDom(dom) {
        const cleaned = dom.cloneNode(true);
        cleaned.querySelectorAll([
          "script", "style", "noscript", "meta", "link",
          "aside", ".ads", ".footer", ".header", ".sidebar"
        ]).forEach(el => el.remove());
        cleaned.querySelectorAll("*").forEach(el => {
          const allowed = ALLOWED_ATTRS[el.tagName.toLowerCase()] || [];
          [...el.attributes].forEach(attr => {
            if (!allowed.includes(attr.name)) el.removeAttribute(attr.name);
          });
        });
        return cleaned;
      }

      function compressDOM(element) {
        if (!element) return null;
        function compress(node) {
          while (node.nodeType === Node.ELEMENT_NODE &&
            node.childNodes.length === 1 &&
            node.firstChild.nodeType === Node.ELEMENT_NODE) {
            node = node.firstChild;
          }
          [...node.childNodes].forEach((child) => {
            const compressedChild = compress(child);
            if (compressedChild !== child) node.replaceChild(compressedChild, child);
          });
          return node;
        }
        return compress(element);
      }

      function elementToArray(node) {
        if (node.nodeType === Node.COMMENT_NODE) return null;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          return text.length ? text : null;
        }
        const tagName = node.tagName.toLowerCase();
        const childArray = [...node.childNodes]
          .map(elementToArray)
          .filter(child => child !== null);
        // Add attributes as the first element if it's not empty
        const attributes = (ALLOWED_ATTRS[node.tagName.toLowerCase()] || [])
          .reduce((acc, attr) => {
            const attribute = node.attributes[attr];
            if (attribute) acc[attribute.name] = attribute.value;
            return acc;
          }, {});
        if (Object.keys(attributes).length > 0) {
          childArray.unshift(attributes);
        }
        return [tagName, childArray];
      }

      function removeEmpty(arr) {
        if (!Array.isArray(arr) || arr.length !== 2) return arr;

        const children = arr[1]
          .map(removeEmpty)
          .filter(child => !(Array.isArray(child) ? child.length === 0 : child == null));

        return children.length ? [arr[0], children] : [];
      }

      const targetDom = selectedHtml
        ? document.createRange().createContextualFragment(selectedHtml).firstElementChild
        : document.body;
      const cleanedDom = cleanDom(targetDom);
      const compressedDom = compressDOM(cleanedDom);
      const structuredArray = elementToArray(compressedDom)
      const compressedArray = removeEmpty([structuredArray]);
      const content = JSON.stringify(compressedArray);

      chrome.runtime.sendMessage({ action: "ask_ai", content, model, prompt });
    }

    const { selectedHTML } = await StorageHelper.get("selectedHTML");

    if (selectedHTML) {
      processPageContent(prompt, selectedModel, selectedHTML);
    } else {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: processPageContent,
        args: [prompt, selectedModel]
      });
    }
  }

  static async validateApiKey(model) {
    const keyMap = {
      openai: "openaiApiKey",
      gemini: "geminiApiKey",
      anthropic: "anthropicApiKey"
    };

    if (!keyMap[model.type]) return true;

    const data = await StorageHelper.get(keyMap[model.type], "sync");
    if (!data[keyMap[model.type]]) {
      alert("API Key is not set. Please configure it on the options page.");
      chrome.runtime.openOptionsPage();
      return false;
    }
    return true;
  }
}

export { ContentProcessor };