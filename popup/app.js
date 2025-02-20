import { StorageHelper } from "../src/storageHelper.js";
import { chatManager } from "../src/chatManager.js";
import { ModelManager } from "../src/modelManager.js";
import { PromptManager } from "../src/promptManager.js";
import { contentProcessor } from "../src/contentProcessor.js";
import { DomSelectManager } from "../src/domSelectManager.js";

const DOMElements = {
  chatBox: document.getElementById("chat"),
  htmlBox: document.getElementById("html-box"),
  modelSelect: document.getElementById("modelSelect"),
  customPromptInput: document.getElementById("customPrompt"),
  savePromptBtn: document.getElementById("savePromptBtn"),
  submitPromptBtn: document.getElementById("submitPromptBtn"),
  promptList: document.getElementById("promptList"),
  activateSelectionBtn: document.getElementById("activateSelectionBtn"),
  settingsBtn: document.getElementById("settingsBtn")
};

let domSelectManager = null;

/** 저장된 데이터 로드 */
async function loadSavedData() {
  const { savedPrompts = [], selectedModel } = await StorageHelper.get(["savedPrompts", "selectedModel"], "sync");

  if (savedPrompts.length) PromptManager.renderList(savedPrompts);
  if (selectedModel) DOMElements.modelSelect.value = selectedModel;
}

/** 이벤트 리스너 설정 */
function setupEventListeners() {
  DOMElements.customPromptInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  });

  DOMElements.savePromptBtn.addEventListener("click", savePrompt);
  DOMElements.submitPromptBtn.addEventListener("click", submitPrompt);
  DOMElements.chatBox.addEventListener("scroll", chatManager.saveScrollPosition.bind(chatManager));
  chrome.runtime.onMessage.addListener(handleIncomingMessages);
  DOMElements.settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  window.addEventListener("beforeunload", cleanup);
}

/** 프롬프트 입력 처리 */
function submitPrompt() {
  const prompt = DOMElements.customPromptInput.value.trim();
  if (!prompt) return;

  contentProcessor.submitPrompt(prompt);
  DOMElements.customPromptInput.value = "";
}

/** 프롬프트 저장 */
function savePrompt() {
  const prompt = DOMElements.customPromptInput.value.trim();
  if (!prompt) return;

  StorageHelper.get("savedPrompts", "sync").then(({ savedPrompts = [] }) => {
    savedPrompts.push(prompt);
    StorageHelper.set({ savedPrompts }, "sync").then(() => {
      PromptManager.renderList(savedPrompts);
      DOMElements.customPromptInput.value = "";
    });
  });
}

/** 백그라운드 메시지 처리 */
function handleIncomingMessages(message) {
  if (message.action === "stream_update") {
    chatManager.appendToLastAiMessage(message.chunk);
  } else if (message.action === "response_result") {
    chatManager.addAiResponseMessage(message.summary, ModelManager.getSelectedModel());
    chatManager.removePlaceholder();
    chatManager.saveChatHistory();
  }
}

/** DOM 선택 기능 초기화 */
function initializeDomSelector() {
  domSelectManager = new DomSelectManager(DOMElements.htmlBox);
  DOMElements.activateSelectionBtn.addEventListener("click", domSelectManager.toggle.bind(domSelectManager));
}

/** 페이지 언로드 시 정리 */
function cleanup() {
  console.log("Cleaning up before unload...");
  chatManager.saveChatHistory();
}

/** 테마 적용 */
function applyTheme() {
  chrome.storage.sync.get("theme", (data) => {
    if (data.theme) document.documentElement.setAttribute("data-theme", data.theme);
  });
}

/** 앱 초기화 */
async function initializeApp() {
  applyTheme();
  await loadSavedData();
  await ModelManager.loadModels();
  ModelManager.addEventListener();
  setupEventListeners();
  initializeDomSelector();
  chatManager.init();
}

document.addEventListener("DOMContentLoaded", initializeApp);