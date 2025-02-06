// popup/app.js
import { StorageHelper } from "../src/storageHelper.js";
import { chatManager } from "../src/chatManager.js";
import { ApiService } from "../src/apiService.js";
import { UIHelper } from "../src/uiHelper.js";
import { ModelManager } from "../src/modelManager.js";
import { PromptManager } from "../src/promptManager.js";
import { ContentProcessor } from "../src/contentProcessor.js";
import { DomSelectManager } from "../src/domSelectManager.js";

// DOM 요소들을 한 곳에서 관리
const DOMElements = {
  chatBox: document.getElementById("chat"),
  modelSelect: document.getElementById("modelSelect"),
  customPromptInput: document.getElementById("customPrompt"),
  savePromptBtn: document.getElementById("savePromptBtn"),
  submitPromptBtn: document.getElementById("submitPromptBtn"),
  promptList: document.getElementById("promptList"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  activateSelectionBtn: document.getElementById("activateSelectionBtn")
};

// 전역 객체(예: ChatManager, DomSelectManager 등)
let chatManager = null;
let domSelectManager = null;

/**
 * DOM 요소 초기화 (popup.html 내 각 요소 참조)
 */
function initializeDOMElements() {
  // DOMElements는 이미 위에서 초기화되었으므로 필요한 경우 추가적인 초기화 작업을 진행
  // (예: document.getElementById() 로 새로 참조)
}

/**
 * 저장된 데이터(프롬프트 목록, 선택된 모델 등) 로드
 */
async function loadSavedData() {
  const { savedPrompts = [], selectedModel } = await StorageHelper.get(["savedPrompts", "selectedModel"], "sync");

  if (savedPrompts.length) {
    PromptManager.renderList(savedPrompts);
  }
  if (selectedModel) {
    DOMElements.modelSelect.value = selectedModel;
  }
}

/**
 * 이벤트 핸들러들을 등록하는 함수
 */
function setupEventListeners() {
  // 모델 선택 변경 시 (저장)
  DOMElements.modelSelect.addEventListener("change", ModelManager.saveSelectedModel);

  // 프롬프트 입력: 엔터키 제출 (Shift+Enter로 줄바꿈 허용)
  DOMElements.customPromptInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  });

  // 프롬프트 저장 버튼 클릭
  DOMElements.savePromptBtn.addEventListener("click", savePrompt);

  // 프롬프트 전송 버튼 클릭
  DOMElements.submitPromptBtn.addEventListener("click", submitPrompt);

  // 채팅 삭제 버튼 클릭
  DOMElements.clearChatBtn.addEventListener("click", clearChat);

  // 채팅 박스 스크롤 시 현재 위치 저장
  DOMElements.chatBox.addEventListener("scroll", chatManager.saveScrollPosition);

  // 백그라운드 및 다른 스크립트의 메시지 수신 처리
  chrome.runtime.onMessage.addListener(handleIncomingMessages);

  // 페이지 언로드 전 정리 작업
  window.addEventListener("beforeunload", cleanup);
}

/**
 * 프롬프트 입력 처리 함수 (엔터키 또는 전송 버튼)
 */
function submitPrompt() {
  const prompt = DOMElements.customPromptInput.value.trim();
  if (prompt) {
    // ContentProcessor가 프롬프트 제출 및 API 호출, 채팅 UI 업데이트를 처리
    ContentProcessor.submitPrompt(prompt);
    DOMElements.customPromptInput.value = "";
  }
}

/**
 * 프롬프트 저장 처리 함수
 */
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

/**
 * 채팅 삭제 처리 함수
 */
function clearChat() {
  DOMElements.chatBox.classList.add("fade-out");
  setTimeout(() => {
    StorageHelper.remove(["chatHistory", "chatScrollPosition"], "local").then(() => {
      DOMElements.chatBox.innerHTML = "";
      DOMElements.chatBox.classList.remove("fade-out", "visible");
    });
  }, 300);
}

/**
 * 백그라운드에서 전달된 메시지 처리 함수
 * (예: "summary_result" 메시지를 받아 AI 응답을 채팅에 추가)
 */
function handleIncomingMessages(message) {
  if (message.action === "summary_result") {
    const selectedModel = ModelManager.getSelectedModel();
    // message.summary가 AiResponse 객체이거나 단순 텍스트인 경우에 맞게 처리
    if (selectedModel && message.summary) {
      chatManager.addAiResponseMessage(message.summary, selectedModel);
    }
    chatManager.removePlaceholder();
    chatManager.saveChatHistory();
  }
  // (stream_update 등의 메시지도 필요 시 추가 처리)
}

/**
 * DOM 선택 기능 초기화 (DomSelectManager)
 */
function initializeDomSelector() {
  domSelectManager = new DomSelectManager();
  StorageHelper.get("selectedHTML", "local").then(({ selectedHTML }) => {
    if (selectedHTML?.trim()) {
      domSelectManager.setActive(true);
      document.getElementById("html-content").innerHTML = selectedHTML;
    }
  });
  DOMElements.activateSelectionBtn.addEventListener("click", domSelectManager.toggle.bind(domSelectManager));
}

/**
 * 정리 작업 (페이지 언로드 전)
 */
function cleanup() {
  console.log("Cleaning up before unload...");
  // 추가적으로 필요한 정리 작업(예: 이벤트 리스너 제거 등)
}

/**
 * 앱 초기화 함수
 */
async function initializeApp() {
  // 1. DOM 요소 초기화
  initializeDOMElements();

  // 2. 저장된 데이터(프롬프트, 모델 등) 로드
  await loadSavedData();

  // 3. 모델 관리 초기화: 모델 로드 및 드롭다운 옵션 업데이트, 저장된 모델 복원
  await ModelManager.loadModels();

  // 4. 이벤트 핸들러 등록
  setupEventListeners();

  // 5. DOM 선택 기능 초기화 (사용자가 페이지 일부를 선택할 수 있도록)
  initializeDomSelector();

  // 6. 채팅 기록 로드 (저장된 대화 내역 복원)
  chatManager.loadChatHistory();
}

// DOMContentLoaded 이벤트 발생 시 앱 초기화
document.addEventListener("DOMContentLoaded", initializeApp);