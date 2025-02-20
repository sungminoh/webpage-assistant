// src/contentProcessor.js
import { StorageHelper } from "./storageHelper.js";
import { chatManager } from "./chatManager.js";
import { ModelManager } from "./modelManager.js";
import { convertHtmlToCleanCompressedJson } from "../src/utils/htmlUtils.js";

class ContentProcessor {
  constructor() {
    if (ContentProcessor.instance) {
      return ContentProcessor.instance;
    }
    ContentProcessor.instance = this;
  }

  async submitPrompt(prompt) {
    if (!prompt) return;

    const model = ModelManager.getSelectedModel();
    if (!model) return;

    // Validate API key before proceeding.
    if (!(await this.validateApiKey(model))) return;

    // Update the UI with the user's prompt.
    chatManager.addMessage("User", prompt);
    chatManager.saveChatHistory();
    chatManager.showPlaceholder();

    // Check if we have stored HTML content.
    const { selectedHTML } = await StorageHelper.get("selectedHTML");

    if (selectedHTML) {
      const cleanCompressedJson = convertHtmlToCleanCompressedJson(selectedHTML);
      chrome.runtime.sendMessage({
        action: "ask_ai",
        content: JSON.stringify(cleanCompressedJson),
        model,
        prompt
      });
    }
  }

  async validateApiKey(model) {
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


export const contentProcessor = new ContentProcessor();