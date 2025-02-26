// contentProcessor.js
import { StorageHelper } from './storageHelper'; // Assuming this is the storage utility
import { convertHtmlToCleanCompressedJson } from './utils/htmlUtils';
import TurndownService from 'turndown';

turndown = new TurndownService();

class ContentProcessor {
  // Validate API key for the selected model
  async validateApiKey(model) {
    const { apiKeys = {} } = await StorageHelper.get("apiKeys", "sync");
    const modelType = model.type;
    const apiKey = apiKeys[modelType];
    return !!apiKey; // Returns true if API key exists for the model type
  }

  // Submit prompt to the AI model
  async submitPrompt(id, model, html) {
    // Check if model is selected and API key is valid
    if (!model || !(await this.validateApiKey(model))) {
      console.log("Invalid model selection or missing API key.");
      return;
    }

    // Retrieve htmlMode from storage (assumed to be 'html' or 'markdown')
    const { htmlMode = "html" } = await StorageHelper.get("htmlMode", "sync");

    // Prepare content based on htmlMode
    const content = htmlMode === "markdown"
      ? turndownService.turndown(html || "")
      : JSON.stringify(convertHtmlToCleanCompressedJson(html || ""));

    // Send message to background script
    chrome.runtime.sendMessage({
      action: "ask_ai",
      id,
      request: {
        content,
        model
      }
    });
  }
}

// Export singleton instance
export const contentProcessor = new ContentProcessor();