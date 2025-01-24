document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chat");
  const modelSelect = document.getElementById("modelSelect");
  const customPromptInput = document.getElementById("customPrompt");
  const savePromptBtn = document.getElementById("savePromptBtn");
  const submitPromptBtn = document.getElementById("submitPromptBtn");
  const promptList = document.getElementById("promptList");

  chrome.storage.sync.get(["savedPrompts", "selectedModel"], (data) => {
    if (data.savedPrompts) {
      renderPromptList(data.savedPrompts);
    }
    if (data.selectedModel) {
      modelSelect.value = data.selectedModel;
    }
  });

  // Save selected model when changed
  modelSelect.addEventListener("change", () => {
    const selectedModel = modelSelect.value;
    chrome.storage.sync.set({ selectedModel: selectedModel }, () => {
      console.log("Model saved:", selectedModel);
    });
  });

  savePromptBtn.addEventListener("click", () => {
    const prompt = customPromptInput.value.trim();
    if (prompt) {
      chrome.storage.sync.get("savedPrompts", (data) => {
        const prompts = data.savedPrompts || [];
        prompts.push(prompt);
        chrome.storage.sync.set({ savedPrompts: prompts }, () => {
          renderPromptList(prompts);
          customPromptInput.value = "";
        });
      });
    }
  });

  function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function saveScrollPosition() {
    chrome.storage.local.set({ chatScrollPosition: chatBox.scrollTop });
  }

  chatBox.addEventListener("scroll", saveScrollPosition);

  function loadChatHistory() {
    chrome.storage.local.get(["chatHistory", "chatScrollPosition"], (data) => {
      if (data.chatHistory && data.chatHistory.length > 0) {
        data.chatHistory.forEach(({ sender, text }) => {
          addChatMessage(sender, text);
        });
        if (data.chatScrollPosition !== undefined) {
          chatBox.scrollTop = data.chatScrollPosition;
        } else {
          scrollToBottom();
        }
      }
    });
  }

  function renderPromptList(prompts) {
    promptList.innerHTML = "";
    prompts.forEach((prompt, index) => {
      const li = document.createElement("li");
      li.draggable = true;

      // Create drag handle (hamburger icon)
      const dragHandle = document.createElement("div");
      dragHandle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
        </svg>`;
      dragHandle.className = "drag-handle";

      // Create prompt text div
      const promptText = document.createElement("div");
      promptText.textContent = prompt;
      promptText.className = "prompt-text";

      // Create delete button (close icon)
      const deleteBtn = document.createElement("div");
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
        </svg>`;
      deleteBtn.className = "delete-btn";
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deletePrompt(index);
      });

      li.append(dragHandle, promptText, deleteBtn);

      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", index);
      });
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggedIndex = e.dataTransfer.getData("text/plain");
        movePrompt(draggedIndex, index);
      });
      li.addEventListener("click", () => {
        customPromptInput.value = prompt;
        submitPrompt(prompt);
      });
      promptList.appendChild(li);
    });
  }

  function movePrompt(fromIndex, toIndex) {
    chrome.storage.sync.get("savedPrompts", (data) => {
      const prompts = data.savedPrompts || [];
      const movedItem = prompts.splice(fromIndex, 1)[0];
      prompts.splice(toIndex, 0, movedItem);
      chrome.storage.sync.set({ savedPrompts: prompts }, () => renderPromptList(prompts));
    });
  }

  function deletePrompt(index) {
    const promptItems = document.querySelectorAll("#promptList li");
    promptItems[index].classList.add("fade-out");

    setTimeout(() => {
      chrome.storage.sync.get("savedPrompts", (data) => {
        const prompts = data.savedPrompts || [];
        prompts.splice(index, 1);
        chrome.storage.sync.set({ savedPrompts: prompts }, () => renderPromptList(prompts));
      });
      promptItems[index].classList.remove("fade-out");
    }, 300);
  }

  function saveChatHistory() {
    const messages = [...chatBox.children].map((li) => ({
      sender: li.classList.contains("ai-message") ? "AI" : "User",
      text: li.querySelector(".message-text").innerText
    }));
    chrome.storage.local.set({ chatHistory: messages });
  }


  function submitPrompt(prompt) {
    chrome.storage.sync.get("openaiApiKey", (data) => {
      if (!data.openaiApiKey) {
        alert("API Key is not set. Please configure it on the options page.");
        chrome.runtime.openOptionsPage();
        return;
      }
      const model = modelSelect.value;
      if (prompt) {
        addChatMessage("User", prompt);
        showPlaceholder();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: extractContent,
            args: [prompt, model]
          });
        });
      }
    });
  }

  function showPlaceholder() {
    const chatBox = document.getElementById("chat");
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.innerText = "AI is thinking...";
    chatBox.appendChild(placeholder);
  }

  function removePlaceholder() {
    const placeholder = document.querySelector(".placeholder");
    if (placeholder) placeholder.remove();
  }

  submitPromptBtn.addEventListener("click", () => {
    const prompt = customPromptInput.value.trim();
    if (prompt) {
      submitPrompt(prompt);
      customPromptInput.value = "";
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "summary_result") {
      addChatMessage("AI", message.summary);
      removePlaceholder();
      saveChatHistory();
    }
  });

  function addChatMessage(sender, text) {
    // Show chat box if hidden
    if (!chatBox.classList.contains("visible")) {
      chatBox.classList.add("visible");
    }

    const messageContainer = document.createElement("li");
    messageContainer.classList.add(sender === "AI" ? "ai-message" : "user-message");

    const messageText = document.createElement("div");
    messageText.classList.add("message-text");
    messageText.innerText = text;

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");

    const copyBtn = document.createElement("div");
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
      <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
      </svg>`;
    copyBtn.className = "copy-btn";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
          <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
          </svg>`;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
            <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
            </svg>`;
        }, 2000);
      });
    });

    buttonContainer.appendChild(copyBtn);
    messageContainer.appendChild(messageText);
    messageContainer.appendChild(buttonContainer);
    chatBox.appendChild(messageContainer);
    scrollToBottom();
  }

  document.getElementById("clearChatBtn").addEventListener("click", () => {
    const chatBox = document.getElementById("chat");
    chatBox.classList.add("fade-out");
    setTimeout(() => {
      chrome.storage.local.remove(["chatHistory", "chatScrollPosition"], () => {
        console.log("Chat history cleared.");
        chatBox.innerHTML = "";
        chatBox.classList.remove("fade-out");
        chatBox.classList.remove("visible");  // Hide the chat box after clearing
      });
    }, 300);
  });

  loadChatHistory();

  function extractContent(prompt, model) {
    function removeUnnecessaryAttributes(dom) {
      // Clone the document body to avoid modifying the original page
      const clonedBody = dom.cloneNode(true);

      // Define allowed attributes to retain (e.g., src for images, href for links)
      const allowedAttributes = {
        'a': ['href'],  // Retain href in anchor tags
        'img': ['src', 'alt'],  // Retain src and alt in images
        'iframe': ['src'],  // Retain iframe src attribute
      };

      clonedBody.querySelectorAll('*').forEach(el => {
        // Get allowed attributes for the current tag
        const allowed = allowedAttributes[el.tagName.toLowerCase()] || [];

        // Remove all attributes except the allowed ones
        [...el.attributes].forEach(attr => {
          if (!allowed.includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        });
      });

      return clonedBody
    }

    const cleanedDom = removeUnnecessaryAttributes(document.body);
    // console.log(cleanedDom);

    function removeEmptyTags(dom) {
      // Clone the document body to avoid modifying the live page
      const clonedBody = dom.cloneNode(true);

      function removeEmptyElements(element) {
        // Recursively remove empty elements
        Array.from(element.children).forEach(child => {
          removeEmptyElements(child);
          if (!(child.innerText || "").trim() && !child.children.length) {
            child.remove();
          }
        });
      }

      // Start cleanup from the cloned document body
      removeEmptyElements(clonedBody);

      // Return the cleaned HTML content as a string
      return clonedBody;
    }

    const simplifedDom = removeEmptyTags(cleanedDom);
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
    const compressedDom = compressDOM(simplifedDom);

    chrome.runtime.sendMessage({
      action: "summarize",
      content: compressedDom.innerHTML.trim(),
      model: model,
      prompt: prompt
    });
  }
});

