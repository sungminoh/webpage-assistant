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
        data.chatHistory.forEach(({ sender, text, usage }) => {
          this.addMessage(sender, text, usage);
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
    const messages = [...DOMElements.chatBox.children].map((li) => {
      const sender = li.classList.contains("ai-message") ? "AI" : "User";
      const text = li.querySelector(".message-text").innerText;
      const usageInfo = li.querySelector(".usage-info");
      const usage = usageInfo ? {
        inputTokens: usageInfo.querySelector(".input-tokens").innerText.split(": ")[1],
        outputTokens: usageInfo.querySelector(".output-tokens").innerText.split(": ")[1],
        totalPrice: parseFloat(usageInfo.querySelector(".price").innerText.split(": ")[1].replace(/\$/, ""))
      } : null;
      return { sender, text, usage };
    });
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

  addMessage(sender, text, usageInfo = null) {
    if (!DOMElements.chatBox.classList.contains("visible")) {
      DOMElements.chatBox.classList.add("visible");
    }

    const messageContainer = document.createElement("li");
    messageContainer.classList.add(sender === "AI" ? "ai-message" : "user-message");

    const messageBodyContainer = document.createElement("div");
    const messageText = document.createElement("span");
    messageText.classList.add("message-text");
    messageText.innerText = text;
    messageBodyContainer.appendChild(messageText);

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");

    const copyBtn = UIHelper.createCopyButton(text);

    buttonContainer.appendChild(copyBtn);
    messageContainer.appendChild(messageBodyContainer);
    messageContainer.appendChild(buttonContainer);

    if (usageInfo) {
      const usageInfoContainer = document.createElement("div");
      usageInfoContainer.classList.add("usage-info");

      const inputTokens = document.createElement("span");
      inputTokens.classList.add("input-tokens");
      inputTokens.innerText = `Input Tokens: ${usageInfo.inputTokens}`;

      const outputTokens = document.createElement("span");
      outputTokens.classList.add("output-tokens");
      outputTokens.innerText = `Output Tokens: ${usageInfo.outputTokens}`;

      const price = document.createElement("span");
      price.classList.add("price");
      price.innerText = `Price: $${usageInfo.totalPrice.toFixed(4)}`;

      usageInfoContainer.appendChild(inputTokens);
      usageInfoContainer.appendChild(document.createTextNode(" | "));
      usageInfoContainer.appendChild(outputTokens);
      usageInfoContainer.appendChild(document.createTextNode(" | "));
      usageInfoContainer.appendChild(price);

      messageBodyContainer.appendChild(usageInfoContainer);
    }

    DOMElements.chatBox.appendChild(messageContainer);
    this.scrollToBottom();
  },

  addAiResponseMessage(aiResponse, model) {
    const inputPrice = model.inputPrice * aiResponse.inputTokens / 1000;
    const outputPrice = model.outputPrice * aiResponse.outputTokens / 1000;
    const totalPrice = inputPrice + outputPrice;
    const usageInfo = {
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      totalPrice: totalPrice
    };
    const messageText = aiResponse.content;
    this.addMessage("AI", messageText, usageInfo);
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

    if (selectedModel.type === 'openai') {
      const { openaiApiKey } = await chrome.storage.sync.get("openaiApiKey");
      if (!openaiApiKey) {
        alert("API Key is not set. Please configure it on the options page.");
        chrome.runtime.openOptionsPage();
        return;
      }
    }
    if (selectedModel.type === 'anthropic') {
      const { anthropicApiKey } = await chrome.storage.sync.get("anthropicApiKey");
      if (!anthropicApiKey) {
        alert("API Key is not set. Please configure it on the options page.");
        chrome.runtime.openOptionsPage();
        return;
      }
    }

    if (!prompt) return;

    // Add user message to chat
    ChatManager.addMessage("User", prompt);
    ChatManager.saveChatHistory();
    ChatManager.showPlaceholder();


    function processPageContent(prompt, model, selectedHtml) {
      function removeUnnecessaryTags(dom) {
        const doc = dom.cloneNode(true); // Clone the original document to avoid modifying it directly
        // Remove unnecessary elements
        doc.querySelectorAll([
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
        ])
          .forEach(el => el.remove());
        return doc;
      }

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

      function elementToJson(element) {
        if (element.nodeType === 3) {  // TEXT_NODE
            return element.textContent.trim() || null;
        }
        
        let obj = {};
        let tag = element.tagName.toLowerCase();
        let children = Array.from(element.childNodes)
            .map(elementToJson)
            .filter(child => child !== null);  // Remove empty text nodes
        
        obj[tag] = [element.textContent.trim() || "", ...children];
        return obj;
    }


      let targetDom = document.body;
      if (selectedHtml) {
        // const parser = new DOMParser();
        // targetDom = parser.parseFromString(selectedHtml, "text/html");
        targetDom = document.createRange().createContextualFragment(selectedHtml).firstElementChild;
      }
      const removedDom = removeUnnecessaryTags(targetDom);
      const cleanedDom = removeUnnecessaryAttributes(removedDom);
      const simplifedDom = removeEmptyTags(cleanedDom);
      const compressedDom = compressDOM(simplifedDom);
      const jsonDom = elementToJson(compressedDom);
      const content = JSON.stringify(jsonDom);

      chrome.runtime.sendMessage({
        action: "summarize",
        content: content,
        model,
        prompt
      });
    }

    chrome.storage.local.get("selectedHTML", function (data) {
      if (data.selectedHTML) {
        processPageContent(prompt, selectedModel, data.selectedHTML)
      } else {
        const tabs = chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: processPageContent,
          args: [prompt, selectedModel]
        });
      }
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
  constructor(type, name, inputPrice = null, outputPrice = null) {
    this.type = type; // 'openai' or 'ollama'
    this.name = name;
    this.inputPrice = inputPrice; // Input price per 1K tokens in USD
    this.outputPrice = outputPrice; // Output price per 1K tokens in USD
  }

  serialize() {
    // Base64 encode to handle special characters like ':'
    return btoa(JSON.stringify({
      type: this.type,
      name: this.name,
      inputPrice: this.inputPrice,
      outputPrice: this.outputPrice
    }));
  }

  static deserialize(value) {
    const decoded = JSON.parse(atob(value));
    return new Model(decoded.type, decoded.name, decoded.inputPrice, decoded.outputPrice);
  }
}

class ModelManager {
  static models = [];

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

  static async loadModels() {
    // Always start with default models
    ModelManager.models = [
      ...ModelManager.getOpenAiModels(),
      ...ModelManager.getAnthropicModels(),
    ];

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
        `Input: $${model.inputPrice}/1K tokens, Output: $${model.outputPrice}/1K tokens`;
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


class DomSelectManager {
  constructor() {
    this.active = false;
  }

  toggle() {
    this.setActive(!this.active)
  }

  setActive(active) {
    this.active = active;
    DOMElements.activateSelectionBtn.innerHTML = this.active ? `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368"><path d="m500-120-56-56 142-142-142-142 56-56 142 142 142-142 56 56-142 142 142 142-56 56-142-142-142 142Zm-220 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368"><path d="M440-120v-400h400v80H576l264 264-56 56-264-264v264h-80Zm-160 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/></svg>`;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleDomSelector", active: this.active });
    });
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
  DOMElements.activateSelectionBtn = document.getElementById("activateSelectionBtn");

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

  const domSelectManager = new DomSelectManager();
  chrome.storage.local.get("selectedHTML", function (data) {
    if (data.selectedHTML) {
      domSelectManager.setActive(true)
    }
  });
  DOMElements.activateSelectionBtn.addEventListener("click", domSelectManager.toggle.bind(domSelectManager));
  // window.addEventListener('beforeunload', domSelectManager.unloadHandler);

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
      const selectedModel = ModelManager.getSelectedModel();
      ChatManager.addAiResponseMessage(message.summary, selectedModel);
      ChatManager.removePlaceholder();
      ChatManager.saveChatHistory();
    }
  });

  // Load initial chat history
  ChatManager.loadChatHistory();

  window.addEventListener("beforeunload", () => {
    console.log("Cleaning up before unload...");
    // Any necessary cleanup (e.g., remove event listeners)
  });
});
