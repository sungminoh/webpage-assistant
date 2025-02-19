// src/contentProcessor.js
import { StorageHelper } from "./storageHelper.js";
import { chatManager } from "./chatManager.js";
import { ModelManager } from "./modelManager.js";

class ContentProcessor {
  static async submitPrompt(prompt) {
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
      chrome.runtime.sendMessage({
        action: "ask_ai",
        content: selectedHTML,
        model,
        prompt
      })
    } else {
      // Otherwise, inject a script into the active tab so that we can access document.body.
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: (prompt, model) => chrome.runtime.sendMessage({
          action: "ask_ai",
          content: document.body.outerHTML,
          model,
          prompt
        }),
        args: [prompt, model]
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


export { ContentProcessor };