document.addEventListener("DOMContentLoaded", () => {
  const openaiApiKeyInput = document.getElementById("openaiApiKeyInput");
  const anthropicApiKeyInput = document.getElementById("anthropicApiKeyInput");
  const basePromptInput = document.getElementById("basePromptInput");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  const DEFAULT_PROMPT = `I'm giving you webpage content. Answer based on that.`; // Default value

  // Load saved values from Chrome storage
  chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt"], (data) => {
    if (data.openaiApiKey) {
      openaiApiKeyInput.value = data.openaiApiKey;
    }
    if (data.anthropicApiKey) {
      anthropicApiKeyInput.value = data.anthropicApiKey;
    }

    // Set default prompt if no value exists in storage
    basePromptInput.value = data.basePrompt || DEFAULT_PROMPT;
  });

  // Save API keys and base prompt to Chrome storage
  saveBtn.addEventListener("click", () => {
    const openaiApiKey = openaiApiKeyInput.value.trim();
    const anthropicApiKey = anthropicApiKeyInput.value.trim();
    const basePrompt = basePromptInput.value.trim() || DEFAULT_PROMPT; // Use default if empty

    chrome.storage.sync.set({ openaiApiKey: openaiApiKey, anthropicApiKey: anthropicApiKey, basePrompt: basePrompt }, () => {
      status.textContent = "Settings saved successfully!";
      status.style.color = "green";
      setTimeout(() => { status.textContent = ""; }, 3000);
    });
  });
});
