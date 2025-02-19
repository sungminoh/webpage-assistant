// src/contentProcessor.js
import { StorageHelper } from "./storageHelper.js";
import { chatManager } from "./chatManager.js";
import { ModelManager } from "./modelManager.js";

class ContentProcessor {
  static async submitPrompt(prompt) {
    if (!prompt) return;

    const selectedModel = ModelManager.getSelectedModel();
    if (!selectedModel) return;

    // Validate API key before proceeding.
    if (!(await this.validateApiKey(selectedModel))) return;

    // Update the UI with the user's prompt.
    chatManager.addMessage("User", prompt);
    chatManager.saveChatHistory();
    chatManager.showPlaceholder();

    // Check if we have stored HTML content.
    const { selectedHTML } = await StorageHelper.get("selectedHTML");

    if (selectedHTML) {
      // Process the stored HTML directly in this context.
      processPageContent(prompt, selectedModel, selectedHTML);
    } else {
      // Otherwise, inject a script into the active tab so that we can access document.body.
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

    // If the model type does not require an API key, skip validation.
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

/**
 * This function processes the DOM content and sends it for AI processing.
 * It can run in two contexts:
 *   - In the popup, using stored HTML (passed as selectedHtml), or
 *   - Injected into the page to use document.body.
 *
 * Because chrome.scripting.executeScript serializes the function,
 * all its helper functions are defined inside.
 *
 * @param {string} prompt - The user prompt.
 * @param {Object} model - The selected model.
 * @param {string} [selectedHtml] - Optional HTML string from storage.
 */
function processPageContent(prompt, model, selectedHtml) {
  const ALLOWED_ATTRS = {
    a: ["href"],
    img: ["src", "alt"],
    iframe: ["src"]
  };

  /**
   * Clones the DOM and removes unwanted elements and attributes.
   * @param {HTMLElement} dom
   * @returns {HTMLElement} Cleaned DOM
   */
  function cleanDom(dom) {
    const cleaned = dom.cloneNode(true);
    // Remove undesired elements in one go.
    cleaned.querySelectorAll(
      "script, style, noscript, meta, link, aside, .ads, .footer, .header, .sidebar"
    ).forEach(el => el.remove());

    // For every element, remove any attribute that is not explicitly allowed.
    cleaned.querySelectorAll("*").forEach(el => {
      const allowed = ALLOWED_ATTRS[el.tagName.toLowerCase()] || [];
      Array.from(el.attributes).forEach(attr => {
        if (!allowed.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return cleaned;
  }


  /**
   * Recursively compresses the DOM by collapsing chains of single-element nodes.
   * @param {Node} node
   * @returns {Node} Compressed DOM node
   */
  function compressDOM(node) {
    if (!node) return null;
    // Collapse nodes that have exactly one element child.
    while (
      node.nodeType === Node.ELEMENT_NODE &&
      node.childNodes.length === 1 &&
      node.firstChild.nodeType === Node.ELEMENT_NODE
    ) {
      node = node.firstChild;
    }
    // Process and replace children recursively.
    Array.from(node.childNodes).forEach(child => {
      const compressedChild = compressDOM(child);
      if (compressedChild !== child) {
        node.replaceChild(compressedChild, child);
      }
    });
    return node;
  }

  /**
   * Recursively converts a DOM node into an array structure.
   * - Text nodes return trimmed text.
   * - Comment nodes return null.
   * - Element nodes return an array of the form: [tagName, children]
   *   where children is an array that may start with an attributes object.
   *
   * Nodes with no meaningful content are pruned (returned as an empty array).
   *
   * @param {Node} node
   * @returns {Array|string|null}
   */
  function domNodeToStructure(node) {
    if (node.nodeType === Node.COMMENT_NODE) return null;
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return text || null;
    }
    
    // For element nodes: record tag and allowed attributes.
    const tagName = node.tagName.toLowerCase();
    const allowedAttrs = ALLOWED_ATTRS[tagName] || [];
    const attrs = {};
    allowedAttrs.forEach(attr => {
      const value = node.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    });

    // Process children recursively.
    const children = [];
    node.childNodes.forEach(child => {
      const converted = domNodeToStructure(child);
      // Only add non-null, non-empty results.
      if (
        converted !== null &&
        !(Array.isArray(converted) && converted.length === 0)
      ) {
        children.push(converted);
      }
    });

    // If attributes exist, prepend them.
    if (Object.keys(attrs).length > 0) {
      children.unshift(attrs);
    }

    // Return an empty array if no content; otherwise return [tagName, children].
    return children.length ? [tagName, children] : [];
  }


  /**
   * Full pipeline: cleans, compresses, converts to structure, and JSON-encodes.
   * @param {HTMLElement} dom
   * @returns {string} JSON string representing the DOM structure.
   */
  function processDomToJson(dom) {
    const cleaned = cleanDom(dom);
    const compressed = compressDOM(cleaned);
    const structure = domNodeToStructure(compressed);
    return JSON.stringify(structure);
  }

  // Determine the target DOM element: use stored HTML if available; otherwise, use document.body.
  const targetDom = selectedHtml
    ? document
        .createRange()
        .createContextualFragment(selectedHtml)
        .firstElementChild
    : document.body;

  // Process the DOM content and send a message with the results.
  const content = processDomToJson(targetDom);
  chrome.runtime.sendMessage({ action: "ask_ai", content, model, prompt });
}

export { ContentProcessor };