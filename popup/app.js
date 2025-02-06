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
  activateSelectionBtn: document.getElementById("activateSelectionBtn"),
  settingsBtn: document.getElementById("settingsBtn")
};

// 전역 객체(예: ChatManager, DomSelectManager 등)
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
  DOMElements.chatBox.addEventListener("scroll", chatManager.saveScrollPosition.bind(chatManager));

  // 백그라운드 및 다른 스크립트의 메시지 수신 처리
  chrome.runtime.onMessage.addListener(handleIncomingMessages);

  // 설정 버튼 클릭 시 옵션 페이지 열기
  DOMElements.settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

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
  // 스트림 방식 응답 청크 처리
  if (message.action === "stream_update") {
    // chatManager 인스턴스는 전역 또는 initializeApp 내부에서 생성되어 있어야 합니다.
    chatManager.appendToLastAiMessage(message.chunk);
  } else if (message.action === "response_result") {
    const selectedModel = ModelManager.getSelectedModel();
    if (selectedModel && message.summary) {
      chatManager.addAiResponseMessage(message.summary, selectedModel);
    }
    chatManager.removePlaceholder();
    chatManager.saveChatHistory();
  }
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
  chatManager.saveChatHistory();
}

function applyTheme() {
  // 저장된 테마를 로드하여 document에 적용합니다.
  chrome.storage.sync.get("theme", (data) => {
    if (data.theme) {
      document.documentElement.setAttribute("data-theme", data.theme);
    }
  });

  // HTML에 테마 토글 버튼이 있다고 가정 (예: id="themeToggleBtn")
  const themeToggleButton = document.getElementById("themeToggleBtn");
  if (themeToggleButton) {
    themeToggleButton.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      const newTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", newTheme);
      chrome.storage.sync.set({ theme: newTheme });
    });
  }
};


/**
 * 앱 초기화 함수
 */
async function initializeApp() {
  // 1. DOM 요소 초기화
  initializeDOMElements();
  applyTheme();

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