import React, { useState, useEffect, useRef, useCallback } from "react";
import { StorageHelper } from "./storageHelper.js";
import { ChatManager } from "./chatManager.js";
import { ModelManager } from "./modelManager.js";
import { PromptManager } from "./promptManager.js";
import { contentProcessor } from "./contentProcessor.js";
import { DomSelectManager } from "./domSelectManager.js";

const App = () => {
  // State for custom prompt input and saved prompts
  const [customPrompt, setCustomPrompt] = useState("");
  const [savedPrompts, setSavedPrompts] = useState([]);

  // Refs for DOM elements
  const chatBoxRef = useRef(null);
  const htmlBoxContainerRef = useRef(null);
  const modelSelectRef = useRef(null);

  // Local instance of DomSelectManager stored in state
  const [domSelectManager, setDomSelectManager] = useState(null);

  // Load saved prompts and model from storage
  const loadSavedData = async () => {
    const { savedPrompts: storedPrompts = [], selectedModel } = await StorageHelper.get(
      ["savedPrompts", "selectedModel"],
      "sync"
    );
    setSavedPrompts(storedPrompts);
    if (selectedModel && modelSelectRef.current) {
      modelSelectRef.current.value = selectedModel;
    }
  };

  // Submit the prompt if not empty
  const submitPrompt = () => {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    contentProcessor.submitPrompt(prompt);
    setCustomPrompt("");
  };

  // Save the prompt to storage and update the list
  const savePrompt = async () => {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    const { savedPrompts: storedPrompts = [] } = await StorageHelper.get("savedPrompts", "sync");
    const newPrompts = [...storedPrompts, prompt];
    await StorageHelper.set({ savedPrompts: newPrompts }, "sync");
    setSavedPrompts(newPrompts);
    setCustomPrompt("");
  };

  // Handle incoming messages from the background script
  const handleIncomingMessages = useCallback((message) => {
    if (message.action === "stream_update") {
      chatManager.appendToLastAiMessage(message.chunk);
    } else if (message.action === "response_result") {
      chatManager.addAiResponseMessage(message.summary, ModelManager.getSelectedModel());
      chatManager.removePlaceholder();
      chatManager.saveChatHistory();
    }
  }, []);

  // Toggle the DOM selection functionality
  const toggleDomSelect = () => {
    if (domSelectManager) {
      domSelectManager.toggle();
    }
  };

  // Apply the saved theme
  const applyTheme = () => {
    chrome.storage.sync.get("theme", (data) => {
      if (data.theme) {
        document.documentElement.setAttribute("data-theme", data.theme);
      }
    });
  };

  // Set up chrome message listener on mount and clean it up on unmount
  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleIncomingMessages);
    return () => {
      chrome.runtime.onMessage.removeListener(handleIncomingMessages);
    };
  }, [handleIncomingMessages]);

  // Save chat history before the window unloads
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("Cleaning up before unload...");
      chatManager.saveChatHistory();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Initialize the DomSelectManager once the html container is ready
  useEffect(() => {
    if (htmlBoxContainerRef.current) {
      const manager = new DomSelectManager(htmlBoxContainerRef.current);
      setDomSelectManager(manager);
    }
  }, []);

  // Perform initializations on component mount
  useEffect(() => {
    applyTheme();
    loadSavedData();
    ModelManager.loadModels().then(() => {
      ModelManager.addEventListener();
    });
    chatManager.init();
  }, []);
 

  return (
    <div className="container">
      {/* Chat Area */}
      {ChatApp}
      <section className="chat-container hidden">
        <ul
          id="chat"
          className="chat-box"
          ref={chatBoxRef}
          onScroll={chatManager.saveScrollPosition.bind(chatManager)}
        >
          {/* Chat messages will be appended by chatManager */}
        </ul>
        <div className="page-corner">
          <div className="page-fold"></div>
          <div className="page-fold-shadow"></div>
        </div>
      </section>

      {/* Input Area */}
      <section className="input-container visible">
        <div className="top-bar">
          {/* Left Controls */}
          <div className="left-controls">
            <div className="button-group">
              <button
                id="activateSelectionBtn"
                className="icon-btn"
                aria-label="Activate DOM selection"
                onClick={toggleDomSelect}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
                  <path d="M440-120v-400h400v80H576l264 264-56 56-264-264v264h-80Zm-160 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div className="model-container">
            <select id="modelSelect" ref={modelSelectRef} aria-label="Select Model">
              <option value="model1">Model 1: Default Long Name Example</option>
              <option value="model2">Model 2</option>
              <option value="model3">Model 3</option>
            </select>
          </div>

          {/* Right Controls */}
          <div className="right-controls">
            <div className="button-group">
              <button
                id="settingsBtn"
                className="icon-btn"
                aria-label="Settings"
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
                  <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Prompt Input */}
        <textarea
          id="customPrompt"
          placeholder="Enter your prompt..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        ></textarea>

        {/* Prompt Buttons */}
        <div className="prompt-buttons button-group">
          <button id="savePromptBtn" className="icon-btn" aria-label="Save prompt" onClick={savePrompt}>
            <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
              <path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z" />
            </svg>
          </button>
          <button id="submitPromptBtn" className="icon-btn" aria-label="Send prompt" onClick={submitPrompt}>
            <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
              <path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
            </svg>
          </button>
        </div>
      </section>

      {/* HTML Preview Area */}
      <section className="html-container visible">
        <div id="html-box-container" className="html-box-container" ref={htmlBoxContainerRef}>
          <div className="html-box html-content"></div>
          <div className="markdown-box html-content"></div>
        </div>
        <div className="bottom-bar">
          <div className="left-controls">
            <div className="html-box-buttons button-group"></div>
          </div>
          <div className="right-controls">
            <div className="html-box-buttons button-group"></div>
          </div>
        </div>
      </section>

      {/* Prompt List */}
      <ul id="promptList">
        {savedPrompts.map((prompt, index) => (
          <li key={index}>{prompt}</li>
        ))}
      </ul>
    </div>
  );
};

export default App;