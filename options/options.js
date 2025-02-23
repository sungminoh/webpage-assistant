// options/options.js
document.addEventListener("DOMContentLoaded", () => {
  const openaiApiKeyInput = document.getElementById("openaiApiKeyInput");
  const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
  const anthropicApiKeyInput = document.getElementById("anthropicApiKeyInput");
  const basePromptInput = document.getElementById("basePromptInput");
  const themeSelect = document.getElementById("themeSelect");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  // Load saved values, including the selected theme
  chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt", "theme"], (data) => {
    if (data.openaiApiKey) openaiApiKeyInput.value = data.openaiApiKey;
    if (data.geminiApiKey) geminiApiKeyInput.value = data.geminiApiKey;
    if (data.anthropicApiKey) anthropicApiKeyInput.value = data.anthropicApiKey;
    if (data.basePrompt) basePromptInput.value = data.basePrompt;
    const theme = data.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
    themeSelect.value = theme;
  });

  // Save settings (including the chosen theme) when the save button is clicked
  saveBtn.addEventListener("click", () => {
    const apiKeys = {
      openai: openaiApiKeyInput.value.trim(),
      gemini: geminiApiKeyInput.value.trim(),
      anthropic: anthropicApiKeyInput.value.trim()
    }
    const basePrompt = basePromptInput.value.trim();
    const theme = themeSelect.value;
    chrome.storage.sync.set({ apiKeys, basePrompt, theme }, () => {
      status.textContent = "Settings saved successfully!";
      status.style.color = "green";
      setTimeout(() => { status.textContent = ""; }, 3000);
    });
    document.documentElement.setAttribute("data-theme", theme);
  });

  // Optional: update theme immediately when user changes the selector
  themeSelect.addEventListener("change", () => {
    const theme = themeSelect.value;
    document.documentElement.setAttribute("data-theme", theme);
  });
});