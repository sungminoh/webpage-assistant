// src/chatManager.js
import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";

export class ChatManager {
  /**
   * @param {HTMLElement} chatBox - 채팅 메시지를 표시할 DOM 요소
   */
  constructor(chatBox) {
    if (!chatBox) {
      throw new Error("ChatManager requires a valid chatBox element.");
    }
    this.chatBox = chatBox;
  }

  /**
   * 채팅 영역을 스크롤하여 가장 아래로 이동합니다.
   */
  scrollToBottom() {
    this.chatBox.scrollTop = this.chatBox.scrollHeight;
  }

  /**
   * 현재 채팅 영역의 스크롤 위치를 chrome.storage.local에 저장합니다.
   */
  saveScrollPosition() {
    chrome.storage.local.set({ chatScrollPosition: this.chatBox.scrollTop });
  }

  /**
   * 저장된 채팅 기록과 스크롤 위치를 로드하여 채팅 영역에 표시합니다.
   */
  async loadChatHistory() {
    const { chatHistory, chatScrollPosition } = await StorageHelper.get(
      ["chatHistory", "chatScrollPosition"]
    );

    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      chatHistory.forEach(({ sender, text, usage }) => {
        this.addMessage(sender, text, usage);
      });
      this.chatBox.scrollTop = chatScrollPosition ?? this.chatBox.scrollHeight;
    }
  }

  /**
   * DOM 내 특정 요소에서 토큰 값을 추출합니다.
   * @param {HTMLElement} element - 토큰 정보를 포함하는 요소
   * @param {string} selector - 토큰 정보가 들어있는 자식 요소 선택자
   * @returns {string} 추출된 토큰 값 (없으면 "0")
   */
  extractToken(element, selector) {
    return element.querySelector(selector)?.innerText.split(": ")[1] || "0";
  }

  /**
   * 채팅 영역에 표시된 메시지들을 저장합니다.
   */
  async saveChatHistory() {
    const messages = Array.from(this.chatBox.children)
      .map((li) => {
        const sender = li.classList.contains("ai-message") ? "AI" : "User";
        const textElement = li.querySelector(".message-text");
        if (!textElement) return null;

        const usageInfoEl = li.querySelector(".usage-info");
        let usage = null;
        if (usageInfoEl) {
          usage = {
            inputTokens: this.extractToken(usageInfoEl, ".input-tokens"),
            outputTokens: this.extractToken(usageInfoEl, ".output-tokens"),
            totalPrice: parseFloat(this.extractToken(usageInfoEl, ".price").replace("$", ""))
          };
        }
        return { sender, text: textElement.innerText, usage };
      })
      .filter(Boolean);

    await StorageHelper.set({ chatHistory: messages });
  }

  /**
   * "AI is thinking..." 플레이스홀더 메시지를 추가합니다.
   */
  showPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.innerText = "AI is thinking...";
    this.chatBox.appendChild(placeholder);
  }

  /**
   * 플레이스홀더 메시지를 제거합니다.
   */
  removePlaceholder() {
    const placeholder = this.chatBox.querySelector(".placeholder");
    if (placeholder) {
      placeholder.remove();
    }
  }

  /**
   * 채팅 메시지를 채팅 영역에 추가합니다.
   * @param {string} sender - "AI" 또는 "User"
   * @param {string} text - 메시지 텍스트
   * @param {object|null} usageInfo - (선택사항) 사용량 정보를 포함한 객체
   */
  addMessage(sender, text, usageInfo = null) {
    // 채팅 영역이 보이지 않을 경우 visible 클래스를 추가합니다.
    if (!this.chatBox.classList.contains("visible")) {
      this.chatBox.classList.add("visible");
    }

    const li = document.createElement("li");
    li.classList.add(sender === "AI" ? "ai-message" : "user-message");
    li.innerHTML = `
      <div>
        <span class="message-text">${text}</span>
        ${usageInfo ? this.createUsageInfo(usageInfo) : ""}
      </div>
      <div class="button-container"></div>
    `;

    // 복사 버튼 생성 및 추가
    const copyButton = UIHelper.createCopyButton(text);
    const buttonContainer = li.querySelector(".button-container");
    if (buttonContainer) {
      buttonContainer.appendChild(copyButton);
    }

    this.chatBox.appendChild(li);
    this.scrollToBottom();
  }

  /**
   * 사용량 정보를 표시하는 HTML 문자열을 생성합니다.
   * @param {object} param0 - inputTokens, outputTokens, totalPrice를 포함하는 객체
   * @returns {string} 사용량 정보를 표시하는 HTML 문자열
   */
  createUsageInfo({ inputTokens, outputTokens, totalPrice }) {
    return `
      <div class="usage-info">
        <span class="input-tokens">Input Tokens: ${inputTokens}</span> |
        <span class="output-tokens">Output Tokens: ${outputTokens}</span> |
        <span class="price">Price: $${totalPrice.toFixed(4)}</span>
      </div>
    `;
  }

  /**
   * 백그라운드 API 호출 후 반환된 AI 응답을 채팅 영역에 추가합니다.
   * @param {object} aiResponse - API 호출 결과 (content, inputTokens, outputTokens)
   * @param {object} model - 선택된 모델 정보 (inputPrice, outputPrice 등)
   */
  addAiResponseMessage(aiResponse, model) {
    const usageInfo = {
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      totalPrice:
        ((model.inputPrice * aiResponse.inputTokens) +
          (model.outputPrice * aiResponse.outputTokens)) /
        1000
    };
    this.addMessage("AI", aiResponse.content, usageInfo);
  }


  /**
   * 스트림 방식으로 전달된 텍스트 청크를 마지막 AI 메시지에 추가합니다.
   * 만약 마지막 메시지가 AI 메시지가 아니면 새 AI 메시지를 생성합니다.
   * @param {string} chunk - AI 응답의 청크(일부분)
   */
  appendToLastAiMessage(chunk) {
    let lastMessage = this.chatBox.lastElementChild;
    // 마지막 메시지가 없거나 AI 메시지가 아니라면 새 AI 메시지를 생성합니다.
    if (!lastMessage || !lastMessage.classList.contains("ai-message")) {
      lastMessage = document.createElement("li");
      lastMessage.classList.add("ai-message");
      // 메시지 텍스트와 버튼 컨테이너를 포함하는 기본 구조
      lastMessage.innerHTML = `
        <div>
          <span class="message-text"></span>
          <div class="button-container"></div>
        </div>
      `;
      this.chatBox.appendChild(lastMessage);
    }
    // 마지막 AI 메시지의 텍스트 요소에 청크를 누적합니다.
    const textEl = lastMessage.querySelector(".message-text");
    textEl.textContent += chunk;
    this.scrollToBottom();
  }

}

export const chatManager = new ChatManager(document.getElementById("chat"));