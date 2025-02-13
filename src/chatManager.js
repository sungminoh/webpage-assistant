// src/chatManager.js
import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";
import { marked } from "../libs/marked.min.js";

export class ChatManager {
  /**
   * @param {HTMLElement} chatBox - The DOM element where chat messages are displayed.
   */
  constructor(chatBox) {
    if (!chatBox) {
      throw new Error("ChatManager requires a valid chatBox element.");
    }
    this.chatBox = chatBox;
    this.chatContainer = chatBox.parentElement;
    this.visible = false;
    this.currentAiMessage = null; // To keep track of the ongoing AI response
  }

  toggleVisibility(forceVisibility) {
    if (forceVisibility === undefined || forceVisibility === null) {
      this.visible = !this.visible;
    } else {
      this.visible = forceVisibility;
    }
    if (this.visible) {
      UIHelper.showElementWithFade(this.chatContainer);
    } else {
      UIHelper.hideElementWithFade(this.chatContainer);
    }
  }

  scrollToBottom(alwaysScroll = false) {
    const isAtBottom = this.chatBox.scrollHeight - this.chatBox.scrollTop <= 1.2 * this.chatBox.clientHeight;
    if (alwaysScroll || isAtBottom) {
      this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }
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
   * @param {string} text - The message text in Markdown.
   * @param {object|null} usageInfo - Usage info (optional).
   * @param {object} options - Optional parameters.
   *        options.updateCurrent: if true, update currentAiMessage instead of creating a new one.
   */
  addMessage(sender, text, usageInfo = null, options = {}) {
    this.toggleVisibility(true);
    // If sender is AI and updateCurrent is true and we already have an ongoing AI message,
    // update that instead of appending a new one.
    let li;
    if (sender === "AI" && options.updateCurrent && this.currentAiMessage) {
      li = this.currentAiMessage;
      const textEl = li.querySelector(".message-text");
      // Re-render markdown for updated text
      textEl.innerHTML = marked.parse(text);
      if (usageInfo) {
        const usageHTML = this.createUsageInfo(usageInfo);
        let usageEl = li.querySelector(".usage-info");
        if (usageEl) {
          usageEl.innerHTML = usageHTML;
        } else {
          textEl.insertAdjacentHTML("afterend", usageHTML);
        }
      }
    } else {
      // Otherwise, create a new message element.
      li = document.createElement("li");
      li.classList.add(sender === "AI" ? "ai-message" : "user-message");

      // Render the message text as Markdown
      const renderedText = marked.parse(text);

      li.innerHTML = `
        <div>
          <span class="message-text">${renderedText}</span>
          ${usageInfo ? this.createUsageInfo(usageInfo) : ""}
        </div>
        <div class="button-container"></div>
      `;

      // If it's an AI message, update currentAiMessage.
      if (sender === "AI") {
        this.currentAiMessage = li;
      }
    }
    // add buttons
    const buttonContainer = li.querySelector(".button-container");
    if (buttonContainer) {
      // Create a delete button
      const deleteButton = UIHelper.createDeleteButton();
      deleteButton.addEventListener('click', () => {
        li.remove();
        this.saveChatHistory();
      });
      // Create a copy button
      const copyButton = UIHelper.createCopyButton(text);
      // Append buttons horizontally
      buttonContainer.appendChild(deleteButton);
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
   * @param {string} chunk - A chunk of AI response text in Markdown.
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
    // Accumulate raw text in a data attribute for re-rendering
    const currentRaw = textEl.getAttribute('data-raw') || "";
    const newRaw = currentRaw + chunk;
    textEl.setAttribute('data-raw', newRaw);
    textEl.innerHTML = marked.parse(newRaw);
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
      content = aiResponse.content;
      usageInfo = (aiResponse.inputTokens ?? null) !== null && (aiResponse.outputTokens ?? null) !== null
        ? ((model.inputPrice * aiResponse.inputTokens) + (model.outputPrice * aiResponse.outputTokens)) / 1000
        : null;
    }

    // If there is a current AI message from streaming, update it.
    if (this.currentAiMessage && this.currentAiMessage.classList.contains("streaming-message")) {
      this.currentAiMessage.classList.remove("streaming-message");
      this.addMessage("AI", content, usageInfo, { updateCurrent: true });
    } else {
      this.addMessage("AI", content, usageInfo);
    }
    this.removePlaceholder();
    this.currentAiMessage = null;
  }
}

export const chatManager = new ChatManager(document.getElementById("chat"));
