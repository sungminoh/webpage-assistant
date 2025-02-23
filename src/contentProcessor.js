// contentProcessor.js
import { StorageHelper } from './storageHelper'; // Assuming this is the storage utility
// import { turndownService } from './turndownService'; // Assuming Markdown conversion utility
import { convertHtmlToCleanCompressedJson } from './utils/htmlUtils'; // Assuming HTML processing utility

class ContentProcessor {
  // Validate API key for the selected model
  async validateApiKey(selectedModel) {
    const { apiKeys = {} } = await StorageHelper.get("apiKeys", "sync");
    const modelType = selectedModel.type;
    const apiKey = apiKeys[modelType];
    return !!apiKey; // Returns true if API key exists for the model type
  }

  // Submit prompt to the AI model
  async submitPrompt(prompt, selectedModel, selectedHTML) {
    // Basic validation
    if (!prompt) {
      console.log("No prompt provided.");
      return;
    }

    // Check if model is selected and API key is valid
      debugger;
    if (!selectedModel || !(await this.validateApiKey(selectedModel))) {
      console.log("Invalid model selection or missing API key.");
      return;
    }

    // Retrieve htmlMode from storage (assumed to be 'html' or 'markdown')
    const { htmlMode = "html" } = await StorageHelper.get("htmlMode", "sync");

    // Prepare content based on htmlMode
    let content;
    if (htmlMode === "markdown") {
      content = turndownService.turndown(selectedHTML || "");
    } else {
      content = JSON.stringify(convertHtmlToCleanCompressedJson(selectedHTML || ""));
    }

    // Send message to background script
    chrome.runtime.sendMessage({
      action: "ask_ai",
      content,
      model: selectedModel,
      prompt,
    });
  }
}

// Export singleton instance
export const contentProcessor = new ContentProcessor();