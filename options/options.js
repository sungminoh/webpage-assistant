// options/options.js
document.addEventListener("DOMContentLoaded", () => {
  const openaiApiKeyInput = document.getElementById("openaiApiKeyInput");
  const anthropicApiKeyInput = document.getElementById("anthropicApiKeyInput");
  const basePromptInput = document.getElementById("basePromptInput");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt"], (data) => {
    if (data.openaiApiKey) {
      openaiApiKeyInput.value = data.openaiApiKey;
    }
    if (data.anthropicApiKey) {
      anthropicApiKeyInput.value = data.anthropicApiKey;
    }
    if (data.basePrompt) {
      basePromptInput.value = data.basePrompt;
    }
  });

  saveBtn.addEventListener("click", () => {
    const openaiApiKey = openaiApiKeyInput.value.trim();
    const anthropicApiKey = anthropicApiKeyInput.value.trim();
    const basePrompt = basePromptInput.value.trim();

    chrome.storage.sync.set({ openaiApiKey, anthropicApiKey, basePrompt }, () => {
      status.textContent = "Settings saved successfully!";
      status.style.color = "green";
      setTimeout(() => { status.textContent = ""; }, 3000);
    });
  });
});