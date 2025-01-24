document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const basePromptInput = document.getElementById("basePromptInput");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  const DEFAULT_PROMPT = `I'm giving you webpage content. Answer based on that.`; // Default value

  // Load saved values from Chrome storage
  chrome.storage.sync.get(["openaiApiKey", "basePrompt"], (data) => {
    if (data.openaiApiKey) {
      apiKeyInput.value = data.openaiApiKey;
    }

    // Set default prompt if no value exists in storage
    basePromptInput.value = data.basePrompt || DEFAULT_PROMPT;
  });

  // Save API key and base prompt to Chrome storage
  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const basePrompt = basePromptInput.value.trim() || DEFAULT_PROMPT; // Use default if empty

    chrome.storage.sync.set({ openaiApiKey: apiKey, basePrompt: basePrompt }, () => {
      status.textContent = "Settings saved successfully!";
      status.style.color = "green";
      setTimeout(() => { status.textContent = ""; }, 3000);
    });
  });
});
