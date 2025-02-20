import { StorageHelper } from "./storageHelper.js";
import { chatManager } from "./chatManager.js";
import { ModelManager } from "./modelManager.js";
import { convertHtmlToCleanCompressedJson } from "./utils/htmlUtils.js";
import { TurndownService } from "../libs/turndown.js";

const turndownService = new TurndownService()

class ContentProcessor {
  constructor() {
    if (!ContentProcessor.instance) {
      ContentProcessor.instance = this;
    }
    return ContentProcessor.instance;
  }

  async submitPrompt(prompt) {
    if (!prompt) return;

    const model = ModelManager.getSelectedModel();
    if (!model || !(await this.validateApiKey(model))) return;

    chatManager.addMessage("User", prompt);
    chatManager.saveChatHistory();
    chatManager.showPlaceholder();

    const { selectedHTML } = await StorageHelper.get("selectedHTML");
    const { htmlMode } = await StorageHelper.get("htmlMode", "sync")
    const content = htmlMode == "markdown"
      ? turndownService.turndown(selectedHTML)
      : JSON.stringify(convertHtmlToCleanCompressedJson(selectedHTML));
    debugger;
    chrome.runtime.sendMessage({
      action: "ask_ai",
      content,
      model,
      prompt
    });
  }

  async validateApiKey(model) {
    const keyMap = {
      openai: "openaiApiKey",
      gemini: "geminiApiKey",
      anthropic: "anthropicApiKey"
    };

    const apiKey = await StorageHelper.get(keyMap[model.type], "sync");
    if (!apiKey[keyMap[model.type]]) {
      alert("API Key is not set. Please configure it on the options page.");
      chrome.runtime.openOptionsPage();
      return false;
    }
    return true;
  }
}

export const contentProcessor = new ContentProcessor();