// DOM Elements
const DOMElements = {
  chatBox: null,
  modelSelect: null,
  customPromptInput: null,
  savePromptBtn: null,
  submitPromptBtn: null,
  promptList: null,
  clearChatBtn: null
};

// Chat functionality
const ChatManager = {
  scrollToBottom() {
    DOMElements.chatBox.scrollTop = DOMElements.chatBox.scrollHeight;
  },

  saveScrollPosition() {
    chrome.storage.local.set({ chatScrollPosition: DOMElements.chatBox.scrollTop });
  },

  loadChatHistory() {
    chrome.storage.local.get(["chatHistory", "chatScrollPosition"], (data) => {
      if (data.chatHistory?.length > 0) {
        data.chatHistory.forEach(({ sender, text }) => {
          this.addMessage(sender, text);
        });
        if (data.chatScrollPosition !== undefined) {
          DOMElements.chatBox.scrollTop = data.chatScrollPosition;
        } else {
          this.scrollToBottom();
        }
      }
    });
  },

  saveChatHistory() {
    const messages = [...DOMElements.chatBox.children].map((li) => ({
      sender: li.classList.contains("ai-message") ? "AI" : "User",
      text: li.querySelector(".message-text").innerText
    }));
    chrome.storage.local.set({ chatHistory: messages });
  },

  showPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.innerText = "AI is thinking...";
    DOMElements.chatBox.appendChild(placeholder);
  },

  removePlaceholder() {
    const placeholder = document.querySelector(".placeholder");
    if (placeholder) placeholder.remove();
  },

  addMessage(sender, text) {
    if (!DOMElements.chatBox.classList.contains("visible")) {
      DOMElements.chatBox.classList.add("visible");
    }

    const messageContainer = document.createElement("li");
    messageContainer.classList.add(sender === "AI" ? "ai-message" : "user-message");

    const messageText = document.createElement("div");
    messageText.classList.add("message-text");
    messageText.innerText = text;

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");

    const copyBtn = UIHelper.createCopyButton(text);

    buttonContainer.appendChild(copyBtn);
    messageContainer.appendChild(messageText);
    messageContainer.appendChild(buttonContainer);
    DOMElements.chatBox.appendChild(messageContainer);
    this.scrollToBottom();
  }
};

// Prompt management
const PromptManager = {
  renderList(prompts) {
    DOMElements.promptList.innerHTML = "";
    prompts.forEach((prompt, index) => {
      const li = document.createElement("li");
      li.draggable = true;

      const dragHandle = UIHelper.createDragHandle();
      const promptText = UIHelper.createPromptText(prompt);
      const deleteBtn = UIHelper.createDeleteButton(() => this.deletePrompt(index));

      li.append(dragHandle, promptText, deleteBtn);

      this.setupDragAndDrop(li, index);
      li.addEventListener("click", () => {
        DOMElements.customPromptInput.value = prompt;
        ContentProcessor.submitPrompt(prompt);
      });

      DOMElements.promptList.appendChild(li);
    });
  },

  setupDragAndDrop(li, index) {
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index);
    });
    li.addEventListener("dragover", (e) => e.preventDefault());
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedIndex = e.dataTransfer.getData("text/plain");
      this.movePrompt(draggedIndex, index);
    });
  },

  movePrompt(fromIndex, toIndex) {
    chrome.storage.sync.get("savedPrompts", (data) => {
      const prompts = data.savedPrompts || [];
      const movedItem = prompts.splice(fromIndex, 1)[0];
      prompts.splice(toIndex, 0, movedItem);
      chrome.storage.sync.set({ savedPrompts: prompts }, () => this.renderList(prompts));
    });
  },

  deletePrompt(index) {
    const promptItems = document.querySelectorAll("#promptList li");
    promptItems[index].classList.add("fade-out");

    setTimeout(() => {
      chrome.storage.sync.get("savedPrompts", (data) => {
        const prompts = data.savedPrompts || [];
        prompts.splice(index, 1);
        chrome.storage.sync.set({ savedPrompts: prompts }, () => this.renderList(prompts));
      });
      promptItems[index].classList.remove("fade-out");
    }, 300);
  }
};

// Content processing
const ContentProcessor = {
  async submitPrompt(prompt) {
    const selectedModel = ModelManager.getSelectedModel();

    const { openaiApiKey } = await chrome.storage.sync.get("openaiApiKey");

    if (selectedModel.type === 'openai' && !openaiApiKey) {
      alert("API Key is not set. Please configure it on the options page.");
      chrome.runtime.openOptionsPage();
      return;
    }

    if (!prompt) return;

    // Add user message to chat
    ChatManager.addMessage("User", prompt);
    ChatManager.showPlaceholder();

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    function processPageContent(prompt, model) {
      function removeUnnecessaryAttributes(dom) {
        const clonedBody = dom.cloneNode(true);
        const allowedAttributes = {
          'a': ['href'],
          'img': ['src', 'alt'],
          'iframe': ['src'],
        };

        clonedBody.querySelectorAll('*').forEach(el => {
          const allowed = allowedAttributes[el.tagName.toLowerCase()] || [];
          [...el.attributes].forEach(attr => {
            if (!allowed.includes(attr.name)) {
              el.removeAttribute(attr.name);
            }
          });
        });

        return clonedBody;
      }

      function removeEmptyTags(dom) {
        const clonedBody = dom.cloneNode(true);

        function removeEmptyElements(element) {
          Array.from(element.children).forEach(child => {
            removeEmptyElements(child);
            if (!(child.innerText || "").trim() && !child.children.length) {
              child.remove();
            }
          });
        }

        removeEmptyElements(clonedBody);
        return clonedBody;
      }

      function compressDOM(element) {
        if (!element) return null;

        function isRedundant(node) {
          return (
            node.nodeType === Node.ELEMENT_NODE &&
            node.childNodes.length === 1 &&
            node.firstChild.nodeType === Node.ELEMENT_NODE
          );
        }

        function compress(node) {
          while (isRedundant(node)) {
            node = node.firstChild;
          }
          Array.from(node.childNodes).forEach((child, index) => {
            const compressedChild = compress(child);
            if (compressedChild !== child) {
              node.replaceChild(compressedChild, child);
            }
          });
          return node;
        }

        return compress(element);
      }

      const cleanedDom = removeUnnecessaryAttributes(document.body);
      const simplifedDom = removeEmptyTags(cleanedDom);
      const compressedDom = compressDOM(simplifedDom);

      chrome.runtime.sendMessage({
        action: "summarize",
        content: compressedDom.innerHTML.trim(),
        model,
        prompt
      });
    }

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: processPageContent,
      args: [prompt, selectedModel]
    });
  }
};

// UI Helper functions
const UIHelper = {
  createDragHandle() {
    const dragHandle = document.createElement("div");
    dragHandle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
      <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
      </svg>`;
    dragHandle.className = "drag-handle";
    return dragHandle;
  },

  createPromptText(text) {
    const promptText = document.createElement("div");
    promptText.textContent = text;
    promptText.className = "prompt-text";
    return promptText;
  },

  createDeleteButton(onClick) {
    const deleteBtn = document.createElement("div");
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
      <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
      </svg>`;
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return deleteBtn;
  },

  createCopyButton(text) {
    const copyBtn = document.createElement("div");
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
      <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
      </svg>`;
    copyBtn.className = "copy-btn";
    copyBtn.addEventListener("click", () => this.handleCopy(copyBtn, text));
    return copyBtn;
  },

  handleCopy(btn, text) {
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
};

class Model {
  constructor(type, name, price = null) {
    this.type = type; // 'openai' or 'ollama'
    this.name = name;
    this.price = price; // Price per 1K tokens in USD
  }

  serialize() {
    // Base64 encode to handle special characters like ':'
    return btoa(JSON.stringify({
      type: this.type,
      name: this.name,
      price: this.price
    }));
  }

  static deserialize(value) {
    const decoded = JSON.parse(atob(value));
    return new Model(decoded.type, decoded.name, decoded.price);
  }
}

class ModelManager {
  static models = [];

  static getDefaultModels() {
    const models = [
      new Model('openai', 'gpt-4o-mini', 0.00015), // 입력 1K 토큰당 $0.00015, 출력 1K 토큰당 $0.0006
      new Model('openai', 'gpt-4o', 0.005), // 입력 1K 토큰당 $0.005, 출력 1K 토큰당 $0.015
      new Model('openai', 'gpt-3.5-turbo', 0.002), // 입력 1K 토큰당 $0.002, 출력 1K 토큰당 $0.002
      new Model('openai', 'o1-preview', 0.015), // 입력 1K 토큰당 $0.015, 출력 1K 토큰당 $0.06
      new Model('openai', 'o1-mini', 0.0075), // 입력 1K 토큰당 $0.0075, 출력 1K 토큰당 $0.03
    ];
    return models;
  }

  static async fetchOllamaModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models.map(m => new Model('ollama', m.name, 0)); // Local models are free
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  }

  static async loadModels() {
    // Always start with default models
    ModelManager.models = ModelManager.getDefaultModels();

    try {
      // Fetch Ollama models asynchronously
      const ollamaModels = await ModelManager.fetchOllamaModels();
      ModelManager.models = [...ModelManager.models, ...ollamaModels];
    } catch (error) {
      console.error('Error loading Ollama models:', error);
      // Default models are already loaded, so continue
    }

    ModelManager.updateModelSelectOptions();
    await ModelManager.restoreSavedModel();
  }

  static updateModelSelectOptions() {
    if (!DOMElements.modelSelect) return;

    DOMElements.modelSelect.innerHTML = '';

    ModelManager.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.serialize();
      const priceText = model.price === 0 ? 'Free' : 
                       `$${model.price}/1K tokens`;
      option.textContent = `${model.name} (${model.type}) - ${priceText}`;
      DOMElements.modelSelect.appendChild(option);
    });
  }

  static async restoreSavedModel() {
    const data = await chrome.storage.sync.get(['selectedModel']);
    if (data.selectedModel && DOMElements.modelSelect) {
      DOMElements.modelSelect.value = data.selectedModel;
    }
  }

  static saveSelectedModel() {
    chrome.storage.sync.set({ selectedModel: DOMElements.modelSelect.value });
  }

  static getSelectedModel() {
    const selectedValue = DOMElements.modelSelect.value;
    return Model.deserialize(selectedValue);
  }
}

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize DOM elements
  DOMElements.chatBox = document.getElementById("chat");
  DOMElements.modelSelect = document.getElementById("modelSelect");
  DOMElements.customPromptInput = document.getElementById("customPrompt");
  DOMElements.savePromptBtn = document.getElementById("savePromptBtn");
  DOMElements.submitPromptBtn = document.getElementById("submitPromptBtn");
  DOMElements.promptList = document.getElementById("promptList");
  DOMElements.clearChatBtn = document.getElementById("clearChatBtn");

  // Load saved data
  chrome.storage.sync.get(["savedPrompts", "selectedModel"], (data) => {
    if (data.savedPrompts) {
      PromptManager.renderList(data.savedPrompts);
    }
    if (data.selectedModel) {
      DOMElements.modelSelect.value = data.selectedModel;
    }
  });

  // Initialize model selection
  await ModelManager.loadModels();
  DOMElements.modelSelect.addEventListener("change", () => ModelManager.saveSelectedModel());

  DOMElements.customPromptInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Allow default behavior for shift+enter (new line)
        return;
      }
      e.preventDefault();
      const prompt = DOMElements.customPromptInput.value.trim();
      if (prompt) {
        ContentProcessor.submitPrompt(prompt);
        DOMElements.customPromptInput.value = "";
      }
    }
  });

  DOMElements.savePromptBtn.addEventListener("click", () => {
    const prompt = DOMElements.customPromptInput.value.trim();
    if (prompt) {
      chrome.storage.sync.get("savedPrompts", (data) => {
        const prompts = data.savedPrompts || [];
        prompts.push(prompt);
        chrome.storage.sync.set({ savedPrompts: prompts }, () => {
          PromptManager.renderList(prompts);
          DOMElements.customPromptInput.value = "";
        });
      });
    }
  });

  DOMElements.submitPromptBtn.addEventListener("click", () => {
    const prompt = DOMElements.customPromptInput.value.trim();
    if (prompt) {
      ContentProcessor.submitPrompt(prompt);
      DOMElements.customPromptInput.value = "";
    }
  });

  DOMElements.clearChatBtn.addEventListener("click", () => {
    DOMElements.chatBox.classList.add("fade-out");
    setTimeout(() => {
      chrome.storage.local.remove(["chatHistory", "chatScrollPosition"], () => {
        DOMElements.chatBox.innerHTML = "";
        DOMElements.chatBox.classList.remove("fade-out", "visible");
      });
    }, 300);
  });

  DOMElements.chatBox.addEventListener("scroll", () => ChatManager.saveScrollPosition());

  // Handle incoming messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "summary_result") {
      ChatManager.addMessage("AI", message.summary);
      ChatManager.removePlaceholder();
      ChatManager.saveChatHistory();
    }
  });

  // Load initial chat history
  ChatManager.loadChatHistory();
});
