// DOM Elements
const DOMElements = {
  chatBox: null,
  modelSelect: null,
  customPromptInput: null,
  savePromptBtn: null,
  submitPromptBtn: null,
  promptList: null,
  clearChatBtn: null,
  activateSelectionBtn: null
};

class StorageHelper {
  static async get(keys, storageArea = 'local') {
    return new Promise((resolve) => {
      chrome.storage[storageArea].get(keys, resolve);
    });
  }

  static async set(data, storageArea = 'local') {
    return new Promise((resolve) => {
      chrome.storage[storageArea].set(data, resolve);
    });
  }

  static async remove(keys, storageArea = 'local') {
    return new Promise((resolve) => {
      chrome.storage[storageArea].remove(keys, resolve);
    });
  }
}

class ChatManager {
  static scrollToBottom() {
    DOMElements.chatBox.scrollTop = DOMElements.chatBox.scrollHeight;
  }

  static saveScrollPosition() {
    chrome.storage.local.set({ chatScrollPosition: DOMElements.chatBox.scrollTop });
  }

  static async loadChatHistory() {
    const { chatHistory, chatScrollPosition } = await StorageHelper.get(["chatHistory", "chatScrollPosition"]);

    if (chatHistory?.length) {
      chatHistory.forEach(({ sender, text, usage }) => this.addMessage(sender, text, usage));
      DOMElements.chatBox.scrollTop = chatScrollPosition ?? DOMElements.chatBox.scrollHeight;
    }
  }

  static extractToken(element, selector) {
    return element.querySelector(selector)?.innerText.split(": ")[1] || "0";
  }

  static async saveChatHistory() {
    const messages = [...DOMElements.chatBox.children].map((li) => {
      const sender = li.classList.contains("ai-message") ? "AI" : "User";
      const textElement = li.querySelector(".message-text");
      if (!textElement) return null;

      const usageInfo = li.querySelector(".usage-info");
      const usage = usageInfo ? {
        inputTokens: this.extractToken(usageInfo, ".input-tokens"),
        outputTokens: this.extractToken(usageInfo, ".output-tokens"),
        totalPrice: parseFloat(this.extractToken(usageInfo, ".price").replace("$", ""))
      } : null;

      return { sender, text: textElement.innerText, usage };
    }).filter(Boolean);

    await StorageHelper.set({ chatHistory: messages });
  }


  static showPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.innerText = "AI is thinking...";
    DOMElements.chatBox.appendChild(placeholder);
  }

  static removePlaceholder() {
    document.querySelector(".placeholder")?.remove();
  }


  static addMessage(sender, text, usageInfo = null) {
    if (!DOMElements.chatBox.classList.contains("visible")) {
      DOMElements.chatBox.classList.add("visible");
    }

    const messageContainer = document.createElement("li");
    messageContainer.classList.add(sender === "AI" ? "ai-message" : "user-message");

    messageContainer.innerHTML = `
      <div>
        <span class="message-text">${text}</span>
        ${usageInfo ? this.createUsageInfo(usageInfo) : ""}
      </div>
      <div class="button-container">
        ${UIHelper.createCopyButton(text).outerHTML}
      </div>`;

    DOMElements.chatBox.appendChild(messageContainer);
    ChatManager.scrollToBottom();
  }

  static createUsageInfo({ inputTokens, outputTokens, totalPrice }) {
    return `
      <div class="usage-info">
        <span class="input-tokens">Input Tokens: ${inputTokens}</span> |
        <span class="output-tokens">Output Tokens: ${outputTokens}</span> |
        <span class="price">Price: $${totalPrice.toFixed(4)}</span>
      </div>`;
  }

  static addAiResponseMessage(aiResponse, model) {
    const usageInfo = {
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      totalPrice: ((model.inputPrice * aiResponse.inputTokens) + (model.outputPrice * aiResponse.outputTokens)) / 1000
    };
    this.addMessage("AI", aiResponse.content, usageInfo);
  }
}

class PromptManager {
  static async renderList(prompts) {
    DOMElements.promptList.innerHTML = "";

    prompts.forEach((prompt, index) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = index;

      const dragHandle = UIHelper.createDragHandle();
      const promptText = UIHelper.createPromptText(prompt);
      const deleteBtn = UIHelper.createDeleteButton(async () => await this.deletePrompt(index))

      li.append(dragHandle, promptText, deleteBtn);
      DOMElements.promptList.appendChild(li);
    });

    this.initDragAndDrop();
    this.initClickHandlers(prompts);
  }

  static initClickHandlers(prompts) {
    DOMElements.promptList.querySelectorAll("li").forEach((li, index) => {
      li.addEventListener("click", (event) => {
        if (event.target.closest(".delete-btn")) return; // Prevent accidental submit on delete
        DOMElements.customPromptInput.value = prompts[index];
        ContentProcessor.submitPrompt(prompts[index]);
      });
    });
  }

  static initDragAndDrop() {
    DOMElements.promptList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", li.dataset.index));
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        this.movePrompt(e.dataTransfer.getData("text/plain"), li.dataset.index);
      });
    });
  }

  static async movePrompt(fromIndex, toIndex) {
    fromIndex = parseInt(fromIndex);
    toIndex = parseInt(toIndex);

    const { savedPrompts = [] } = await StorageHelper.get(["savedPrompts"], "sync");
    if (fromIndex === toIndex || !savedPrompts.length) return;

    const [movedItem] = savedPrompts.splice(fromIndex, 1);
    savedPrompts.splice(toIndex, 0, movedItem);

    await StorageHelper.set({ savedPrompts }, "sync");
    this.renderList(savedPrompts);
  }

  static async deletePrompt(index) {
    const promptItems = document.querySelectorAll("#promptList li");
    promptItems[index].classList.add("fade-out");

    setTimeout(async () => {
      const { savedPrompts = [] } = await StorageHelper.get(["savedPrompts"], "sync");
      savedPrompts.splice(index, 1);
      await StorageHelper.set({ savedPrompts }, "sync");
      this.renderList(savedPrompts);
    }, 300);
  }
}

// Content processing
class ContentProcessor {
  static async submitPrompt(prompt) {
    if (!prompt) return;

    const selectedModel = ModelManager.getSelectedModel();
    if (!selectedModel) return;

    if (!(await this.validateApiKey(selectedModel))) return;

    ChatManager.addMessage("User", prompt);
    ChatManager.saveChatHistory();
    ChatManager.showPlaceholder();

    const { selectedHTML } = await StorageHelper.get("selectedHTML");
    if (selectedHTML) {
      this.processPageContent(prompt, selectedModel, selectedHTML);
    } else {
      this.executeScriptOnActiveTab(prompt, selectedModel);
    }
  }
  static async validateApiKey(model) {
    const keyMap = {
      openai: "openaiApiKey",
      anthropic: "anthropicApiKey"
    };

    if (!keyMap[model.type]) return true;

    const data = await StorageHelper.get(keyMap[model.type], "sync");
    if (!data[keyMap[model.type]]) {
      alert("API Key is not set. Please configure it on the options page.");
      chrome.runtime.openOptionsPage();
      return false;
    }
    return true;
  }
  static processPageContent(prompt, model, selectedHtml) {
    const targetDom = selectedHtml
      ? document.createRange().createContextualFragment(selectedHtml).firstElementChild
      : document.body;

    const cleanedDom = this.cleanDom(targetDom);
    const compressedDom = this.compressDOM(cleanedDom);
    const content = JSON.stringify(this.elementToJson(compressedDom));

    chrome.runtime.sendMessage({ action: "summarize", content, model, prompt });
  }

  static async executeScriptOnActiveTab(prompt, model) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: ContentProcessor.processPageContent,
      args: [prompt, model]
    });
  }

  static cleanDom(dom) {
    const cleaned = dom.cloneNode(true);
    // Remove unnecessary elements
    cleaned.querySelectorAll([
      "script",
      "style",
      // "iframe", 
      "noscript",
      // "img", 
      "meta",
      "link",
      // "button", 
      // "input", 
      // "form", 
      "aside",
      ".ads",
      ".footer",
      ".header",
      ".sidebar"
    ]).forEach(el => el.remove());

    // Remove unnecessary attributes
    cleaned.querySelectorAll("*").forEach(el => {
      const allowedAttrs = { a: ["href"], img: ["src", "alt"], iframe: ["src"] };
      const allowed = allowedAttrs[el.tagName.toLowerCase()] || [];
      [...el.attributes].forEach(attr => {
        if (!allowed.includes(attr.name)) el.removeAttribute(attr.name);
      });
    });

    return this.removeEmptyTags(cleaned);
  }

  static removeEmptyTags(dom) {
    function removeEmpty(el) {
      [...el.children].forEach(child => {
        removeEmpty(child);
        if (!child.textContent.trim() && !child.children.length) child.remove();
      });
    }
    const clonedDom = dom.cloneNode(true);
    removeEmpty(clonedDom);
    return clonedDom;
  }


  static compressDOM(element) {
    if (!element) return null;

    function compress(node) {
      while (node.nodeType === Node.ELEMENT_NODE &&
        node.childNodes.length === 1 &&
        node.firstChild.nodeType === Node.ELEMENT_NODE) {
        node = node.firstChild;
      }

      [...node.childNodes].forEach((child, index) => {
        const compressedChild = compress(child);
        if (compressedChild !== child) node.replaceChild(compressedChild, child);
      });

      return node;
    }

    return compress(element);
  }

  static elementToJson(element) {
    if (element.nodeType === Node.COMMENT_NODE) return null;
    if (element.nodeType === Node.TEXT_NODE) return element.textContent.trim() || null;

    const tag = element.tagName?.toLowerCase();
    const children = [...element.childNodes]
      .map(this.elementToJson)
      .filter(child => child !== null);

    return { [tag]: [element.textContent.trim() || "", ...children] };
  }
}

// UI Helper functions
class UIHelper {
  static createElement(tag, className = "", innerHTML = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
  }

  static createSVGButton(className, svgContent, onClick = null) {
    const button = UIHelper.createElement("div", className, svgContent);
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  static createDragHandle() {
    return UIHelper.createSVGButton("drag-handle", `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
      </svg>`);
  }

  static createPromptText(text) {
    const promptText = UIHelper.createElement("div", "prompt-text");
    promptText.textContent = text;
    return promptText;
  }

  static createDeleteButton(onClick) {
    return UIHelper.createSVGButton("delete-btn", `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
      </svg>`, (event) => {
      event.stopPropagation();
      onClick();
    });
  }

  static createCopyButton(text) {
    const copyBtn = UIHelper.createSVGButton("copy-btn", `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
      </svg>`, () => UIHelper.handleCopy(copyBtn, text));
    return copyBtn;
  }

  static handleCopy(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
          <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
        </svg>`;
      setTimeout(() => {
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
            <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
          </svg>`;
      }, 2000);
    });
  }
}

class Model {
  constructor(type, name, inputPrice = 0, outputPrice = 0) {
    this.type = type;
    this.name = name;
    this.inputPrice = inputPrice;
    this.outputPrice = outputPrice;
  }

  serialize() {
    return btoa(JSON.stringify(this));
  }

  static deserialize(data) {
    try {
      return new Model(...Object.values(JSON.parse(atob(data))));
    } catch {
      return null;
    }
  }
}
class ModelManager {
  static models = [];

  static async loadModels() {
    this.models = [...this.getOpenAiModels(), ...this.getAnthropicModels(), ...(await this.fetchOllamaModels())];
    this.updateModelSelectOptions();
    await this.restoreSavedModel();
  }

  static getOpenAiModels() {
    const models = [
      new Model('openai', 'gpt-4o-mini', 0.00015, 0.0006), // Input $0.00015 per 1K tokens, Output $0.0006 per 1K tokens
      new Model('openai', 'gpt-3.5-turbo', 0.002, 0.002), // Input $0.002 per 1K tokens, Output $0.002 per 1K tokens
      new Model('openai', 'gpt-4o', 0.005, 0.015), // Input $0.005 per 1K tokens, Output $0.015 per 1K tokens
      new Model('openai', 'o1-mini', 0.0075, 0.03), // Input $0.0075 per 1K tokens, Output $0.03 per 1K tokens
      new Model('openai', 'o1-preview', 0.015, 0.06), // Input $0.015 per 1K tokens, Output $0.06 per 1K tokens
    ];
    return models;
  }

  static getAnthropicModels() {
    const models = [
      new Model('anthropic', 'claude-3-5-haiku-20241022', 0.00025, 0.00125), // Input $0.00025 per 1K tokens, Output $0.00125 per 1K tokens
      new Model('anthropic', 'claude-3-5-sonnet-20241022', 0.003, 0.015), // Input $0.003 per 1K tokens, Output $0.015 per 1K tokens
      new Model('anthropic', 'claude-3-opus-20240229', 0.015, 0.075), // Input $0.015 per 1K tokens, Output $0.075 per 1K tokens
    ];
    return models;
  }

  static async fetchOllamaModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models.map(m => new Model('ollama', m.name, 0, 0)); // Local models are free
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  }

  static updateModelSelectOptions() {
    if (!DOMElements.modelSelect) return;

    DOMElements.modelSelect.innerHTML = this.models.map(model => {
      const price = model.inputPrice === 0 && model.outputPrice === 0
        ? 'Free'
        : `Input: $${model.inputPrice}/1K tokens, Output: $${model.outputPrice}/1K tokens`
      return `
      <option value="${model.serialize()}">${model.name} (${model.type} - ${price})</option>
    `}).join("");
  }
  static async restoreSavedModel() {
    const { selectedModel } = await StorageHelper.get(["selectedModel"]);
    if (selectedModel) DOMElements.modelSelect.value = selectedModel;
  }

  static saveSelectedModel() {
    DOMElements.modelSelect.classList.remove("error");
    StorageHelper.set({ selectedModel: DOMElements.modelSelect.value });
  }

  static getSelectedModel() {
    try {
      const selectedValue = DOMElements.modelSelect.value;
      return Model.deserialize(selectedValue);
    } catch (error) {
      DOMElements.modelSelect.classList.add("error");
      return null;
    }
  }
}


class DomSelectManager {
  constructor() {
    this.active = false;
  }

  toggle() {
    this.setActive(!this.active);
  }

  async setActive(active) {
    this.active = active;
    this.updateButtonState();

    if (!active) {
      await this.clearSelectedHTML();
    }

    this.sendToggleMessage();
  }

  updateButtonState() {
    const activateIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="m500-120-56-56 142-142-142-142 56-56 142 142 142-142 56 56-142 142 142 142-56 56-142-142-142 142Zm-220 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/>
      </svg>`;

    const deactivateIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="M440-120v-400h400v80H576l264 264-56 56-264-264v264h-80Zm-160 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/>
      </svg>`;

    DOMElements.activateSelectionBtn.innerHTML = this.active ? activateIcon : deactivateIcon;
    DOMElements.activateSelectionBtn.classList.toggle("highlight", this.active);
  }

  async clearSelectedHTML() {
    await StorageHelper.remove("selectedHTML", "local");
    document.getElementById("html-content").innerHTML = "";
    console.log("Selected HTML cleared.");
  }

  sendToggleMessage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleDomSelector",
        active: this.active
      });
    });
  }
}

function initializeDOMElements() {
  DOMElements.chatBox = document.getElementById("chat");
  DOMElements.modelSelect = document.getElementById("modelSelect");
  DOMElements.customPromptInput = document.getElementById("customPrompt");
  DOMElements.savePromptBtn = document.getElementById("savePromptBtn");
  DOMElements.submitPromptBtn = document.getElementById("submitPromptBtn");
  DOMElements.promptList = document.getElementById("promptList");
  DOMElements.clearChatBtn = document.getElementById("clearChatBtn");
  DOMElements.activateSelectionBtn = document.getElementById("activateSelectionBtn");
}

async function loadSavedData() {
  const { savedPrompts = [], selectedModel } = await StorageHelper.get(["savedPrompts", "selectedModel"], "sync");

  if (savedPrompts.length) {
    PromptManager.renderList(savedPrompts);
  }
  if (selectedModel) {
    DOMElements.modelSelect.value = selectedModel;
  }
}

function setupEventListeners() {
  DOMElements.modelSelect.addEventListener("change", ModelManager.saveSelectedModel);
  DOMElements.customPromptInput.addEventListener("keyup", handlePromptInput);
  DOMElements.savePromptBtn.addEventListener("click", savePrompt);
  DOMElements.submitPromptBtn.addEventListener("click", submitPrompt);
  DOMElements.clearChatBtn.addEventListener("click", clearChat);
  DOMElements.chatBox.addEventListener("scroll", ChatManager.saveScrollPosition);
  chrome.runtime.onMessage.addListener(handleIncomingMessages);
  window.addEventListener("beforeunload", cleanup);
}

function handlePromptInput(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitPrompt();
  }
}

function submitPrompt() {
  const prompt = DOMElements.customPromptInput.value.trim();
  if (prompt) {
    ContentProcessor.submitPrompt(prompt);
    DOMElements.customPromptInput.value = "";
  }
}

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

function clearChat() {
  DOMElements.chatBox.classList.add("fade-out");

  setTimeout(() => {
    StorageHelper.remove(["chatHistory", "chatScrollPosition"], "local").then(() => {
      DOMElements.chatBox.innerHTML = "";
      DOMElements.chatBox.classList.remove("fade-out", "visible");
    });
  }, 300);
}

function handleIncomingMessages(message) {
  if (message.action === "summary_result") {
    const selectedModel = ModelManager.getSelectedModel();
    ChatManager.addAiResponseMessage(message.summary, selectedModel);
    ChatManager.removePlaceholder();
    ChatManager.saveChatHistory();
  }
}

function initializeDomSelector() {
  const domSelectManager = new DomSelectManager();
  StorageHelper.get("selectedHTML", "local").then(({ selectedHTML }) => {
    if (selectedHTML?.trim()) {
      domSelectManager.setActive(true);
      document.getElementById("html-content").innerHTML = selectedHTML;
    }
  });

  DOMElements.activateSelectionBtn.addEventListener("click", domSelectManager.toggle.bind(domSelectManager));
}

function cleanup() {
  console.log("Cleaning up before unload...");
  // Perform any necessary cleanup actions
}

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize DOM elements
  initializeDOMElements();
  // Load saved data
  await loadSavedData();
  // Initialize model selection
  await ModelManager.loadModels();

  setupEventListeners();
  initializeDomSelector();
  ChatManager.loadChatHistory();
})
