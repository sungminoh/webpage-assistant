// options/options.js
document.addEventListener("DOMContentLoaded", () => {
  const openaiApiKeyInput = document.getElementById("openaiApiKeyInput");
  const anthropicApiKeyInput = document.getElementById("anthropicApiKeyInput");
  const basePromptInput = document.getElementById("basePromptInput");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const themeToggleBtn = document.getElementById("themeToggleBtn");

  // 저장된 값을 로드
  chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt", "theme"], (data) => {
    if (data.openaiApiKey) {
      openaiApiKeyInput.value = data.openaiApiKey;
    }
    if (data.anthropicApiKey) {
      anthropicApiKeyInput.value = data.anthropicApiKey;
    }
    if (data.basePrompt) {
      basePromptInput.value = data.basePrompt;
    }
    // 테마 적용
    const theme = data.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
    // 테마 버튼 텍스트 설정
    themeToggleBtn.textContent = theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";
  });

  // 저장 버튼 이벤트
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

  // 테마 토글 버튼 이벤트
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.sync.set({ theme: newTheme });
    themeToggleBtn.textContent = newTheme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";
  });
});