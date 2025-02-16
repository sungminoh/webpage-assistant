// background.js

const SYSTEM_PROMPT = `
You are an AI assistant specialized in analyzing compressed HTML structures to extract and summarize the most **informative, detailed, and functionally useful content** from a given webpage. 
Your goal is to help users **quickly absorb the essential information from a webpage** without reading it in full. Your response should focus on **key insights, core messages, and actionable takeaways**.

# Rules for Summarizing Content Efficiently:

**Extract Key Information with Maximum Clarity**
  - Identify the **main topic, purpose, and key messages** of the page.
  - If the page contains multiple sections, provide **a structured summary** of the most relevant parts.
  - Directly quote original content when possible to ensure accuracy.
  - **Avoid generic overviews**—focus on **specific details that convey the most important information.**

**Summarize in a Way That Feels Like a Human Already Read It**
  - Write as if someone is **giving a quick briefing** on the webpage.
  - **Remove redundant, filler, or non-essential information**.
  - If a webpage contains **a list, table, or structured content**, **reformat it into a concise, digestible format**.
  - If applicable, highlight key numbers, facts, or conclusions.

**Prioritize High-Value Content**
  - **News Articles** → Extract headline, key points, and any impactful quotes or statements.
  - **Product Pages** → Summarize features, specifications, pricing, and unique selling points.
  - **Blogs & Long-Form Content** → Identify **main arguments, supporting evidence, and key conclusions**.
  - **Forums & Discussions** → Summarize the **main question, key responses, and consensus or diverse opinions**.
  - **Research Papers/Reports** → Provide the **objective, methodology, key findings, and conclusion**.

**Adapt Response Language to User’s Last Input**
  - If the user asks in English, respond in English.
  - If the user asks in Korean, respond in Korean.
  - Maintain **fluency and natural tone** in the response.

**Ignore Navigation and UI Elements**
  - Do NOT explain **how to use the website** (unless explicitly asked).
  - Focus **only on extracting information**, not describing how users interact with the site.

# Example Responses:
**News Article Summary**
**User asks:** *"Summarize this news article."*  
**AI response:**  
*"This article discusses the latest developments in AI regulation. The key takeaway is that [Organization] has proposed new guidelines to ensure ethical AI deployment. One expert states, 'This is a critical moment for AI governance.' The regulation is expected to take effect in 2025, affecting major AI developers."*

**Forum Discussion Summary**
**User asks:** *"What are people saying in this forum thread?"*  
**AI response:**  
*"Users are debating whether the new MacBook M3 is worth the upgrade. Some argue that the increased performance justifies the price, while others say the M2 is still sufficient. A user mentions, 'If you're not doing heavy workloads, M2 is more than enough.' Another user counters, 'M3’s GPU upgrades make a huge difference in gaming.'"*

**Product Page Summary**
**User asks:** *"Summarize this product page."*  
**AI response:**  
*"The Samsung Galaxy S24 features a 6.7-inch AMOLED display, Snapdragon 8 Gen 3 chip, and a 50MP main camera. It supports 5G and has a 4,800mAh battery. The base model starts at $999. Key selling points include AI-enhanced photography and a 120Hz refresh rate."*
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
    const { openaiApiKey, anthropicApiKey, geminiApiKey, basePrompt } = await getApiKeys();
    const modelType = request.model.type;

    const apiKey = modelType === "openai"
      ? openaiApiKey
      : modelType === "anthropic"
        ? anthropicApiKey
        : modelType === "gemini"
          ? geminiApiKey
          : null;

    if (!apiKey) {
      return handleError("API Key is missing.");
    }

    const prompt = generatePrompt(request, basePrompt);
    const chatHistory = await getChatHistory();

    console.log(prompt);

    const summary = await callModelApi(modelType, request.model.name, apiKey, prompt, chatHistory);
    
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
    chrome.storage.sync.get([
      "openaiApiKey",
      "geminiApiKey",
      "anthropicApiKey",
      "basePrompt"
    ], (data) => {
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
      resolve(chatHistory.filter(msg => !msg.isPlaceholder));
    });
  });
}

/**
 * Generates the final prompt for the AI model.
 */
function generatePrompt(request, basePrompt, historyText) {
  return `
${SYSTEM_PROMPT}

# **Compressed HTML Representation:**
${request.content}

# **Custom Instructions:**
${basePrompt}
`.trim();
}

/**
 * Calls the appropriate AI model based on the model type.
 */
async function callModelApi(modelType, modelName, apiKey, prompt, chatHistory) {
  if (modelType === "openai") {
    return await callOpenAI(apiKey, modelName, prompt, chatHistory, true);
  } else if (modelType === "gemini") {
    return await callGemini(apiKey, modelName, prompt, chatHistory, true);
  } else if (modelType === "anthropic") {
    return await callAnthropic(apiKey, modelName, prompt, chatHistory);
  }
  throw new Error("Invalid model type.");
}

/**
 * Handles errors by logging and sending an error message.
 */
function handleError(message, error = null) {
  console.error(message, error || "");
  if (error) {
    message += `\n${error.stack || error}`;
  }
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
async function callOpenAI(apiKey, modelName, prompt, chatHistory, stream = false) {
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
        {
          role: "developer",
          content: [ { "type": "text", "text": prompt } ]
        },
        ...chatHistory.map(x => {
          return {
            role: { "AI": "assistant", "User": "user" }[x.sender],
            content: [{ type: "text", text: x.text }]
          }
        })
      ]
    })
  });

  if (!response.ok) {
    let errorMessage = `OpenAI API request failed with status ${response.status}`;
  
    try {
      const errorData = await response.json();
      if (errorData.error && errorData.error.message) {
        errorMessage += `: ${errorData.error.message}`;
      }
    } catch (error) {
      errorMessage += " (Failed to parse error response)";
    }
  
    throw new Error(errorMessage);
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
 * Calls the Google Gemini API (Generative Language API) to generate content.
 * 
 * This function supports both full-response and simulated streaming modes.
 * In streaming mode, it attempts to read newline-separated JSON chunks.
 *
 * @param {string} apiKey - Your Google API key.
 * @param {string} modelName - The Gemini model to use (e.g., "gemini-1.5-flash").
 * @param {string} prompt - The text prompt for generation.
 * @param {boolean} stream - Whether to enable streaming mode.
 * @returns {Promise<AiResponse>} - The generated content wrapped in an AiResponse object.
 */
async function callGemini(apiKey, modelName, prompt, chatHistory, stream = false) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:${stream ? "streamGenerateContent" : "generateContent"}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        ...chatHistory.map(x => {
          return {
            role: { "AI": "model", "User": "user" }[x.sender],
            parts: [{ text: x.text }]
          }
        })
      ]
    })
  });

  if (!response.ok) {
    let errorMessage = `Gemini API request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      errorMessage += '\n' + errorData.map(x => x.error)
        .map(x => `${x.status}: ${x.message}`).join("\n");
    } catch (error) {
      errorMessage += " (Failed to parse error response)";
    }

    throw new Error(errorMessage);
  }

  if (!stream) {
    // Non-streaming: wait for the full JSON response.
    const data = await response.json();
    const generatedText = data.candidates
      ?.map((candidate) =>
        candidate.content?.parts?.map((part) => part.text).join("")
      )
      .join("") || "";
  
    return new AiResponse(
      generatedText,
      data.usageMetadata?.promptTokenCount || 0,
      data.usageMetadata?.candidatesTokenCount || 0
    );
  } else {
    // Streaming response handling
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let fullContent = "";
    let bufferedText = "";
    let totalInputTokens = null;
    let totalOutputTokens = null;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        let chunkText = decoder.decode(value, { stream: !done }).trim();
        // Remove first "[" from the first chunk
        if (bufferedText === "" && chunkText.startsWith("[")) {
          chunkText = chunkText.slice(1);
        }
        // Remove last "]%" from the final chunk
        if (done && chunkText.endsWith("]%")) {
          chunkText = chunkText.slice(0, -2);
        }

        bufferedText += chunkText;
        // Separate individual JSON objects ({ candidates: [...] }) by unit
        let openBraces = 0;
        let startIndex = -1;
        for (let i = 0; i < bufferedText.length; i++) {
          if (bufferedText[i] === "{") {
            if (startIndex === -1) startIndex = i; // Mark start of JSON
            openBraces++;
          } else if (bufferedText[i] === "}") {
            openBraces--;
            if (openBraces === 0) {
              const jsonStr = bufferedText.slice(startIndex, i + 1); // Extract JSON string
              try {
                const parsed = JSON.parse(jsonStr); // Validate JSON
                const candidate = parsed.candidates?.[0];
                const generatedText = candidate?.content?.parts
                  ?.map(part => part.text)
                  .join("");

                if (generatedText) {
                  fullContent += generatedText;
                  // Call sendMessage whenever an individual JSON object is completed
                  chrome.runtime.sendMessage({ action: "stream_update", chunk: generatedText });
                }
                // Update token counts if available
                if (parsed.usageMetadata) {
                  totalInputTokens = parsed.usageMetadata.promptTokenCount;
                  totalOutputTokens = parsed.usageMetadata.candidatesTokenCount;
                }
                bufferedText = bufferedText.slice(i + 1).trim(); // Remove processed JSON
              } catch (err) {
                // JSON is incomplete, return null
                console.warn("Failed to parse JSON part, will retry with the next chunk:", bufferedText);
              }
            }
          }
        }
      }
    }
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