import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";
import { marked } from "../libs/marked.min.js";

export class ChatManager {
  constructor(chatBox) {
    if (!chatBox) throw new Error("ChatManager requires a valid chatBox element.");

    this.chatBox = chatBox;
    this.chatContainer = chatBox.parentElement;
    this.buttons = this.chatContainer.querySelector(".chat-box-buttons");
    this.messages = []; // Store chat messages in an array
    this.visible = false;
    this.currentAiMessageIndex = null; // Track the latest AI message for streaming updates
  }

  init() {
    this.loadChatHistory();
    this.buttons.appendChild(UIHelper.createClearButton(this.clearChat.bind(this)));
  }

  clearChat() {
    this.toggleVisibility(false);
    setTimeout(() => {
      StorageHelper.remove(["chatHistory", "chatScrollPosition"], "local").then(() => {
        this.messages = [];
        this.currentAiMessageIndex = null;
        this.renderChat();
      });
    }, 300);
  }

  toggleVisibility(forceVisibility) {
    this.visible = forceVisibility ?? !this.visible;
    this.visible ? UIHelper.showElementWithFade(this.chatContainer) : UIHelper.hideElementWithFade(this.chatContainer);
  }

  scrollToBottom(alwaysScroll = false) {
    const isAtBottom = this.chatBox.scrollHeight - this.chatBox.scrollTop <= 1.2 * this.chatBox.clientHeight;
    if (alwaysScroll || isAtBottom) this.chatBox.scrollTop = this.chatBox.scrollHeight;
    this.saveScrollPosition();
  }

  async loadChatHistory() {
    const { chatHistory, chatScrollPosition } = await StorageHelper.get(["chatHistory", "chatScrollPosition"]);
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      this.messages = chatHistory;
      this.renderChat();
      this.toggleVisibility(true);
      this.chatBox.scrollTop = chatScrollPosition ?? this.chatBox.scrollHeight;
    }
  }

  async saveScrollPosition() {
    await StorageHelper.set({ chatScrollPosition: this.chatBox.scrollTop });
  }

  async saveChatHistory() {
    await StorageHelper.set({ chatHistory: this.messages });
  }

  showPlaceholder() {
    this.removePlaceholder();
    this.addMessage("AI", "AI is thinking...", null, { isPlaceholder: true });
  }

  removePlaceholder() {
    this.messages = this.messages.filter(msg => !msg.isPlaceholder);
    this.renderChat();
  }

  addMessage(sender, text, usageInfo = null, options = {}) {
    this.toggleVisibility(true);

    if (sender === "AI" && options.updateCurrent && this.currentAiMessageIndex !== null) {
      this.messages[this.currentAiMessageIndex].text = text;
      if (usageInfo) this.messages[this.currentAiMessageIndex].usage = usageInfo;
    } else {
      const newMessage = { sender, text, usage: usageInfo, isPlaceholder: options.isPlaceholder || false };

      if (sender === "AI" && !options.isPlaceholder) {
        this.currentAiMessageIndex = this.messages.length;
      }

      this.messages.push(newMessage);
    }

    this.renderChat();
  }

  /**
   * **Fixes streaming updates to correctly append to the latest AI message.**
   */
  appendToLastAiMessage(chunk) {
    // Ensure the AI message exists for streaming
    if (this.currentAiMessageIndex === null || this.messages[this.currentAiMessageIndex]?.sender !== "AI") {
      this.removePlaceholder();
      this.currentAiMessageIndex = this.messages.length;
      this.messages.push({ sender: "AI", text: chunk, isStreaming: true });
    } else {
      this.messages[this.currentAiMessageIndex].text += chunk;
    }
    this.renderChat();
  }

  addAiResponseMessage(aiResponse, model) {
    this.removePlaceholder();
    let usageInfo = null;
    let content = typeof aiResponse === "string" ? aiResponse : aiResponse.content;

    if (aiResponse.inputTokens != null && aiResponse.outputTokens != null) {
      usageInfo = {
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
        totalPrice: model.getPrice(aiResponse.inputTokens, aiResponse.outputTokens)
      };
    }

    if (this.currentAiMessageIndex !== null) {
      this.messages[this.currentAiMessageIndex].text = content;
      this.messages[this.currentAiMessageIndex].usage = usageInfo;
      this.messages[this.currentAiMessageIndex].isStreaming = false;
    } else {
      this.addMessage("AI", content, usageInfo);
    }
    this.currentAiMessageIndex = null;
  }

  /**
   * **Fix: Ensure messages are correctly indexed when rendering**
   */
  renderChat() {
    this.chatBox.innerHTML = "";

    this.messages.forEach(({ sender, text, usage, isPlaceholder }, index) => {
      const li = document.createElement("li");
      li.classList.add(sender === "AI" ? "ai-message" : "user-message");
      if (isPlaceholder) li.classList.add("placeholder");

      const messageHtml = marked.parse(text);
      li.innerHTML = `
        <div>
          <span class="message-text html-content">${messageHtml}</span>
          ${usage ? this.createUsageInfo(usage) : ""}
        </div>
        <div class="button-container"></div>
      `;

      const buttonContainer = li.querySelector(".button-container");
      if (!isPlaceholder) {
        const deleteButton = UIHelper.createDeleteButton();
        deleteButton.addEventListener("click", () => {
          this.messages.splice(index, 1);
          if (this.currentAiMessageIndex !== null && index >= 0 && this.currentAiMessageIndex > index) {
            this.currentAiMessageIndex--;
          }
          this.saveChatHistory();
          this.renderChat();
        });

        const copyButton = UIHelper.createCopyButton(null, text);
        buttonContainer.appendChild(deleteButton);
        buttonContainer.appendChild(copyButton);
      }

      this.chatBox.appendChild(li);
    });

    this.scrollToBottom();
    this.saveChatHistory();
  }

  createUsageInfo({ inputTokens, outputTokens, totalPrice }) {
    return inputTokens == null && outputTokens == null
      ? ""
      : `<div class="usage-info">
          <span class="input-tokens">Input Tokens: ${inputTokens}</span> |
          <span class="output-tokens">Output Tokens: ${outputTokens}</span> |
          <span class="price">Price: $${totalPrice.toFixed(4)}</span>
        </div>`;
  }
}

export const chatManager = new ChatManager(document.getElementById("chat"));