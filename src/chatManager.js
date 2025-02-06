// src/chatManager.js
import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";

export class ChatManager {
  /**
   * @param {HTMLElement} chatBox - The DOM element where chat messages are displayed.
   */
  constructor(chatBox) {
    if (!chatBox) {
      throw new Error("ChatManager requires a valid chatBox element.");
    }
    this.chatBox = chatBox;
    this.currentAiMessage = null; // To keep track of the ongoing AI response
  }

  scrollToBottom() {
    this.chatBox.scrollTop = this.chatBox.scrollHeight;
  }

  saveScrollPosition() {
    chrome.storage.local.set({ chatScrollPosition: this.chatBox.scrollTop });
  }

  async loadChatHistory() {
    const { chatHistory, chatScrollPosition } = await StorageHelper.get(
      ["chatHistory", "chatScrollPosition"]
    );
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      chatHistory.forEach(({ sender, text, usage }) => {
        this.addMessage(sender, text, usage, { updateCurrent: false });
      });
      this.chatBox.scrollTop = chatScrollPosition ?? this.chatBox.scrollHeight;
    }
  }

  extractToken(element, selector) {
    return element.querySelector(selector)?.innerText.split(": ")[1] || "0";
  }

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

  showPlaceholder() {
    // Remove any existing placeholder before adding a new one
    this.removePlaceholder();
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.innerText = "AI is thinking...";
    this.chatBox.appendChild(placeholder);
  }

  removePlaceholder() {
    const existingPlaceholder = this.chatBox.querySelector(".placeholder");
    if (existingPlaceholder) {
      existingPlaceholder.remove();
    }
  }

  /**
   * Adds a new chat message.
   * @param {string} sender - "AI" or "User"
   * @param {string} text - The message text.
   * @param {object|null} usageInfo - Usage info (optional).
   * @param {object} options - Optional parameters.
   *        options.updateCurrent: if true, update currentAiMessage instead of creating a new one.
   */
  addMessage(sender, text, usageInfo = null, options = {}) {
    // If sender is AI and updateCurrent is true and we already have an ongoing AI message,
    // update that instead of appending a new one.
    if (sender === "AI" && options.updateCurrent && this.currentAiMessage) {
      const textEl = this.currentAiMessage.querySelector(".message-text");
      textEl.textContent = text;
      if (usageInfo) {
        const usageHTML = this.createUsageInfo(usageInfo);
        let usageEl = this.currentAiMessage.querySelector(".usage-info");
        if (usageEl) {
          usageEl.innerHTML = usageHTML;
        } else {
          textEl.insertAdjacentHTML("afterend", usageHTML);
        }
      }
      this.scrollToBottom();
      return;
    }

    // Otherwise, create a new message element.
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

    // If it's an AI message, update currentAiMessage.
    if (sender === "AI") {
      this.currentAiMessage = li;
    }

    const copyButton = UIHelper.createCopyButton(text);
    const buttonContainer = li.querySelector(".button-container");
    if (buttonContainer) {
      buttonContainer.appendChild(copyButton);
    }

    this.chatBox.appendChild(li);
    this.scrollToBottom();
  }

  /**
   * Creates HTML for usage info.
   * @param {object} param0 - An object with inputTokens, outputTokens, totalPrice.
   */
  createUsageInfo({ inputTokens, outputTokens, totalPrice }) {
    return inputTokens == undefined && outputTokens == undefined ? "" : `
      <div class="usage-info">
        <span class="input-tokens">Input Tokens: ${inputTokens}</span> |
        <span class="output-tokens">Output Tokens: ${outputTokens}</span> |
        <span class="price">Price: $${totalPrice.toFixed(4)}</span>
      </div>
    `;
  }

  /**
   * Appends text to the last (streamed) AI message.
   * If no current AI message exists, creates a new one.
   * @param {string} chunk - A chunk of AI response text.
   */
  appendToLastAiMessage(chunk) {
    if (!this.currentAiMessage || !this.currentAiMessage.classList.contains("streaming-message")) {
      // Create a new AI message element if none exists.
      this.currentAiMessage = document.createElement("li");
      this.currentAiMessage.classList.add("ai-message", "streaming-message");
      this.currentAiMessage.innerHTML = `
        <div>
          <span class="message-text"></span>
          <div class="button-container"></div>
        </div>
      `;
      this.removePlaceholder();
      this.chatBox.appendChild(this.currentAiMessage);
    }
    const textEl = this.currentAiMessage.querySelector(".message-text");
    textEl.textContent += chunk;
    this.scrollToBottom();
  }

  /**
   * When the full AI response is available, finalize the current AI message.
   * This method updates the current AI message (if it exists) with the full content and usage info.
   * It also clears the placeholder and resets currentAiMessage.
   * @param {object} aiResponse - An object with content, inputTokens, outputTokens.
   * @param {object} model - Model information (for cost calculation).
   */
  addAiResponseMessage(aiResponse, model) {
    let usageInfo;
    let content;
    if (typeof aiResponse !== 'string') {
      content = aiResponse.content
      // Calculate the total price based on the model's input and output prices and the number of tokens used.
      // Only calculate usageInfo if inputTokens and outputTokens are not null.
      usageInfo = (aiResponse.inputTokens ?? null) !== null && (aiResponse.outputTokens ?? null) !== null
        ? ((model.inputPrice * aiResponse.inputTokens) + (model.outputPrice * aiResponse.outputTokens)) / 1000
        : null;
    }

    // If there is a current AI message from streaming, update it instead of appending a new one.
    if (this.currentAiMessage && this.currentAiMessage.classList.contains("streaming-message")) {
      this.currentAiMessage.classList.remove("streaming-message");
      this.addMessage("AI", content, usageInfo, { updateCurrent: true });
    } else {
      this.addMessage("AI", content, usageInfo);
    }
    // Once finalized, clear the placeholder and reset the streaming marker.
    this.removePlaceholder();
    this.currentAiMessage = null;
  }
}

export const chatManager = new ChatManager(document.getElementById("chat"));