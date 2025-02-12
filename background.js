// background.js

const SYSTEM_PROMPT = `
You are an AI that helps users consume web pages by interpreting a compressed HTML representation and answering their queries based on its structure.

The HTML is provided in the form:
[ tagName, [child1, child2, ...] ]
- Text nodes are trimmed strings.
- Empty text nodes are removed.

### **Rules for Answering Queries:**
1. **Reference the compressed structure** to answer user queries.
2. **Use chat history for context** when relevant.
3. **Follow custom instructions** provided by the user.
4. **If the requested information is unavailable**, explicitly state that and ask if the user would like to retrieve external information.
`.trim();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt"], async (data) => {
      const modelType = request.model.type;
      if ((modelType === "openai" && !data.openaiApiKey) ||
        (modelType === "anthropic" && !data.anthropicApiKey)) {
        console.error("API Key is missing.");
        chrome.runtime.sendMessage({ action: "summary_result", summary: "Error: API Key not set." });
        return;
      }

      chrome.storage.local.get(["chatHistory"], async (historyData) => {
        let chatHistory = historyData.chatHistory || [];
        let historyText = chatHistory.map(entry => `${entry.sender}: ${entry.text}`).join("\n");
        const prompt = `
### **Compressed HTML Representation:**  
${request.content}

### **Custom Instructions:**  
${request.basePrompt}

### **Conversation History:**  
${historyText}

Answer to the user's latest message.
`.trim();
        console.log(prompt)
        try {
          let summary;
          if (modelType === "openai") {
            // Call OpenAI API with streaming enabled.
            summary = await callOpenAI(data.openaiApiKey, request.model.name, SYSTEM_PROMPT, prompt, true);
          } else if (modelType === "anthropic") {
            summary = await callAnthropic(data.anthropicApiKey, request.model.name, SYSTEM_PROMPT, prompt);
          }
          // When the stream is finished, send a final message with the full response.
          chrome.runtime.sendMessage({ action: "summary_result", summary });
        } catch (error) {
          console.error("Error calling API:", error);
          chrome.runtime.sendMessage({ action: "summary_result", summary: "Error: Failed to fetch summary." });
        }
      });
    });
  }
});

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
    chrome.storage.local.set({ selectedHTML: message.html });
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return; // No active tab found.
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
