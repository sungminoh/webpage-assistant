// background.js

const SYSTEM_PROMPT = `
You are an AI assistant specialized in understanding and interpreting web pages based on a compressed HTML structure. Your primary goal is to analyze, infer, and answer user queries accurately using only the provided webpage content while ensuring clarity, conciseness, and logical precision.

The provided HTML is structured as:
[ tagName, [child1, child2, ...] ]
- Text nodes are trimmed strings.
- Empty text nodes are removed.

### Rules for Answering Queries:

0. **Infer the website's purpose before answering.**  
   - Analyze the document’s structure, metadata, and common patterns to determine its function (e.g., news, e-commerce, documentation, forum, blog, etc.).
   - Use inferred context subtly to improve response relevance without explicitly stating it unless asked.  

1. **Base responses primarily on the given web page.**  
   - Prioritize the provided content when answering.  
   - Use logical reasoning and structure-based inference to extract meaning.  
   - Avoid assuming information that is not present in the document.  

2. **Use structural cues for contextual understanding.**  
   - Leverage formatting, headings, lists, tables, and emphasized elements to determine importance.  
   - Recognize UI elements (buttons, menus, links, forms) for functional understanding.  
   - Maintain the original intent and context of the document.  

3. **Follow custom instructions exactly.**  
   - Apply user-provided instructions precisely unless they are undefined or conflict with these core rules.  
   - If no custom instructions exist, default to logical, direct, and concise responses.  

4. **Clearly indicate external knowledge usage.**  
   - If requested information is missing, explicitly state its absence.  
   - If a query requires external knowledge, indicate when non-document sources are used.  

5. **Strictly remove all unnecessary meta-statements.**  
   - No generic intros, explanations, or summary indicators.  
   - Output must be direct, concise, and content-focused.  

Your responses must be precise, structured, and context-aware. Use maximum inference from the given data while only incorporating external information when necessary and explicitly marked.
`.trim();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ask_ai") {
    handleAiRequest(request);
  }
});

/**
 * Handles AI request by fetching necessary data and making API calls.
 */
async function handleAiRequest(request) {
  try {
    const { openaiApiKey, anthropicApiKey, basePrompt } = await getApiKeys();
    const modelType = request.model.type;

    if ((modelType === "openai" && !openaiApiKey) || (modelType === "anthropic" && !anthropicApiKey)) {
      return handleError("API Key is missing.");
    }

    const chatHistory = await getChatHistory();
    const prompt = generatePrompt(request, basePrompt, chatHistory);

    console.log(prompt);

    const summary = await callModelApi(modelType, request.model.name, openaiApiKey, anthropicApiKey, prompt);
    
    chrome.runtime.sendMessage({ action: "response_result", summary });
  } catch (error) {
    handleError("Error: Failed to fetch summary.", error);
  }
}

/**
 * Retrieves API keys and base prompt from storage.
 */
function getApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt"], (data) => {
      resolve(data);
    });
  });
}

/**
 * Retrieves chat history from local storage.
 */
function getChatHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["chatHistory"], (data) => {
      const chatHistory = data.chatHistory || [];
      resolve(chatHistory.map(entry => `${entry.sender}: ${entry.text}`).join("\n"));
    });
  });
}

/**
 * Generates the final prompt for the AI model.
 */
function generatePrompt(request, basePrompt, historyText) {
  return `
### **Compressed HTML Representation:**
${request.content}

### **Custom Instructions:**
${basePrompt}

### **Conversation History:**
${historyText}

Answer to the user's latest message.
  `.trim();
}

/**
 * Calls the appropriate AI model based on the model type.
 */
async function callModelApi(modelType, modelName, openaiKey, anthropicKey, prompt) {
  if (modelType === "openai") {
    return await callOpenAI(openaiKey, modelName, SYSTEM_PROMPT, prompt, true);
  } else if (modelType === "anthropic") {
    return await callAnthropic(anthropicKey, modelName, SYSTEM_PROMPT, prompt);
  }
  throw new Error("Invalid model type.");
}

/**
 * Handles errors by logging and sending an error message.
 */
function handleError(message, error = null) {
  console.error(message, error || "");
  chrome.runtime.sendMessage({ action: "response_result", summary: message });
}

class AiResponse {
  constructor(content, inputTokens, outputTokens) {
    this.content = content;
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
  }
}

/**
 * Calls the OpenAI API with stream enabled. Reads the response stream chunk by chunk,
 * sending each chunk via "stream_update" messages. Accumulates the full content and token usage.
 */
async function callOpenAI(apiKey, modelName, systemPrompt, userPrompt, stream = false) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      stream: stream,  // Enable streaming
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("OpenAI API request failed with status " + response.status);
  }

  if (!stream) {
    const data = await response.json();
    const content = data.choices[0].message.content;
    const usage = data.usage || {};
    return new AiResponse(content, usage.prompt_tokens || 0, usage.completion_tokens || 0);
  } else {

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let fullContent = "";
    let totalInputTokens = null;
    let totalOutputTokens = null;

    // Read stream chunks
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        // Decode the chunk as text
        const chunkText = decoder.decode(value, { stream: !done });
        // Split by newlines (stream data is often sent line by line prefixed with "data:")
        const lines = chunkText.split("\n").filter(line => line.trim().length > 0);
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice("data: ".length).trim();
            if (dataStr === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              // Each parsed chunk is expected to have a structure like:
              // { choices: [ { delta: { content: "..." } } ], usage: { prompt_tokens, completion_tokens } }
              const delta = parsed.choices[0].delta;
              const contentPart = delta?.content || "";
              fullContent += contentPart;
              // Send each chunk as a stream update message
              chrome.runtime.sendMessage({ action: "stream_update", chunk: contentPart });
              // Optionally update usage tokens if provided in this chunk. This is undefined at the moment.
              if (parsed.usage) {
                totalInputTokens = parsed.usage.prompt_tokens;
                totalOutputTokens = parsed.usage.completion_tokens;
              }
            } catch (err) {
              console.error("Error parsing stream chunk:", err);
            }
          }
        }
      }
    }
    // Return a full AiResponse object once streaming is complete.
    return new AiResponse(fullContent, totalInputTokens, totalOutputTokens);
  }
}

/**
 * Calls the Anthropic API (non-streaming example).
 * You can refactor similarly for streaming if Anthropic supports it.
 */
async function callAnthropic(apiKey, modelName, systemPrompt, userPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelName,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 300
    })
  });

  const data = await response.json();
  const content = data.content[0].text;
  const usage = data.usage || {};
  return new AiResponse(content, usage.input_tokens || 0, usage.output_tokens || 0);
}

/**
 * Calls the Ollama API (non-streaming example)
 */
async function callOllama(modelName, systemPrompt, userPrompt) {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false
    })
  });
  const data = await response.json();
  return new AiResponse(data.response, data.prompt_eval_count, data.eval_count);
}

// On installation, set a default model.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ selectedModel: "gpt-4o" });
});

// Additional message handling: store selected HTML and open popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "click_target_dom") {
    chrome.storage.local.set({
      selectedHTML: message.html,
      selectedCSS: message.css,
    });
  }
  if (message.action === "open_popup") {
    chrome.action.openPopup();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open_popup") {
    chrome.action.openPopup();
  } else if (command === "toggle_selector") {
    // Query the active tab in the current window

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) return; // No active tab found.

      // Check if DomSelector already exists in the tab
      const tab = tabs[0]
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => typeof window.DomSelector !== "undefined",
      });

      if (result?.result) {
        console.log("DomSelector is already injected.");
        chrome.tabs.sendMessage(tab.id, { action: "toggleDomSelector" });
      } else {
        console.log("Injecting content script...");
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/content.css"]
        });
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleDomSelector", active: true }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message);
        } else {
          console.log("Response:", response);
        }
      });
    });
  }
});