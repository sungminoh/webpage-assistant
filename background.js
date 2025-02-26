import { injectScript } from "./src/utils/scriptUtils.js";
import { StorageHelper } from "./src/storageHelper.js";

const SYSTEM_PROMPT = `
You are an AI assistant specialized in analyzing web page to extract and summarize the most **informative, detailed, and functionally useful content** from a given webpage. 
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


// Action handlers for runtime messages
const actionHandlers = {
  "ask_ai": handleAiRequest,
  "change_selected_dom": handleChangeSelectedDom,
  "open_popup": handleOpenPopup,
};

// Command handlers for keyboard shortcuts
const commandHandlers = {
  "open_popup": handleOpenPopupCommand,
  "toggle_selector": handleToggleSelectorCommand,
};

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = actionHandlers[message.action];
  if (handler) {
    handler(message, sender);
  } else {
    console.warn(`No handler for action in background: ${message.action}`);
  }
});

// Command listener
chrome.commands.onCommand.addListener(async (command) => {
  const handler = commandHandlers[command];
  if (handler) {
    await handler();
  } else {
    console.warn(`No handler for command in background: ${command}`);
  }
});

/**
 * Handles "ask_ai" action by processing the AI request.
 * @param {Object} message - The incoming message with request object.
 */
async function handleAiRequest(message, sender) {
  const { id, request } = message;
  try {
    if (!id) throw new Error("Request ID is missing.");
    const { content, model } = request;

    const { apiKeys = {}, htmlMode, basePrompt } = await StorageHelper.get(
      ["apiKeys", "htmlMode", "basePrompt"],
      "sync"
    );
    const { type: modelType, name: modelName } = model || {};
    const apiKey = apiKeys[modelType];

    if (!apiKey) return handleError(id, request, "API Key is missing.");

    const prompt = generatePrompt(htmlMode, content, basePrompt);
    console.debug("Generated Prompt:", prompt);

    const chatHistory = await StorageHelper.get(["chatHistory"]).then(
      ({ chatHistory }) => chatHistory?.filter((msg) => !msg.isPlaceholder) || []
    );
    console.debug("Chat History:", chatHistory);

    const response = await callModelApi(modelType, modelName, apiKey, prompt, chatHistory, id);
    chrome.runtime.sendMessage({
      action: "response_result",
      response,
      request,
      id,
    });
  } catch (error) {
    handleError(id, request, "Error: Failed to fetch summary.", error);
  }
}

/**
 * Updates DOM selection in storage.
 * @param {Object} message - The DOM selection message.
 * @param {Object} sender - The sender object with tab info.
 */
function handleChangeSelectedDom(message, sender) {
  StorageHelper.update({
    domSelection: { [sender.tab.id]: message },
  });
}

/**
 * Opens the extension popup.
 */
function handleOpenPopup() {
  chrome.action.openPopup();
}

/**
 * Command handler to open the popup.
 */
async function handleOpenPopupCommand() {
  chrome.action.openPopup();
}

/**
 * Command handler to toggle DOM selector.
 */
async function handleToggleSelectorCommand() {
  await injectScript(3000);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_dom_selector" });
  }
}

/**
 * Generates a formatted prompt based on content and mode.
 * @param {string} htmlMode - The content mode ("markdown" or other).
 * @param {string} content - The content to include.
 * @param {string} basePrompt - Custom instructions.
 * @returns {string} The formatted prompt.
 */
function generatePrompt(htmlMode, content, basePrompt) {
  const contentSection =
    htmlMode === "markdown"
      ? `
# **Web Page Content (Markdown):**
[start]
${content}
[end]`.trim()
      : `
# **Web Page Content (Compressed HTML):**
${content}`.trim();

  const customSection = basePrompt ? `
# **Custom Instructions:**
${basePrompt}`.trim() : "";

  return `
${SYSTEM_PROMPT}

${contentSection}

${customSection}
  `.trim();
}

/**
 * Calls the appropriate AI model API.
 * @param {string} modelType - The type of model (e.g., "openai").
 * @param {string} modelName - The specific model name.
 * @param {string} apiKey - The API key.
 * @param {string} prompt - The prompt to send.
 * @param {Array} chatHistory - The chat history.
 * @param {string} id - The message ID.
 * @returns {Promise<AiResponse>} The AI response.
 */
async function callModelApi(modelType, modelName, apiKey, prompt, chatHistory, id) {
  switch (modelType) {
    case "openai":
      return await callOpenAI(apiKey, modelName, prompt, chatHistory, true, id);
    case "gemini":
      return await callGemini(apiKey, modelName, prompt, chatHistory, true, id);
    case "anthropic":
      return await callAnthropic(apiKey, modelName, prompt, chatHistory, true, id);
    default:
      throw new Error("Invalid model type.");
  }
}

/**
 * Handles errors by logging and sending an error response.
 * @param {string} id - The message ID.
 * @param {object} request - The request.
 * @param {string} message - The error message.
 * @param {Error} [error] - The error object (optional).
 */
function handleError(id, request, message, error = null) {
  console.error(message, error || "");
  if (error) {
    message += `\n${error.stack || error}`;
  }
  chrome.runtime.sendMessage({
    action: "response_result",
    response: { content: message },
    request,
    id,
  });
}

/**
 * Represents an AI response with content and token usage.
 */
class AiResponse {
  constructor(content, inputTokens, outputTokens) {
    this.content = content;
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
  }
}

/**
 * Calls the OpenAI API with streaming support.
 * @param {string} apiKey - The API key.
 * @param {string} modelName - The model name.
 * @param {string} prompt - The prompt.
 * @param {Array} chatHistory - The chat history.
 * @param {boolean} stream - Whether to stream the response.
 * @param {object} id - The request.
 * @returns {Promise<AiResponse>} The response.
 */
async function callOpenAI(apiKey, modelName, prompt, chatHistory, stream = false, id) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      stream,
      messages: [
        { role: "developer", content: prompt },
        ...chatHistory.map((msg) => ({
          role: { AI: "assistant", User: "user" }[msg.sender],
          content: [{ type: "text", text: msg.text }],
        })),
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API failed: ${response.status}`);

  if (!stream) {
    const data = await response.json();
    const content = data.choices[0].message.content;
    const usage = data.usage || {};
    return new AiResponse(content, usage.prompt_tokens || 0, usage.completion_tokens || 0);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let fullContent = "";
  let totalInputTokens = null;
  let totalOutputTokens = null;

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      const chunkText = decoder.decode(value, { stream: !done });
      const lines = chunkText.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          const dataStr = line.slice(6).trim();
          try {
            const parsed = JSON.parse(dataStr);
            const contentPart = parsed.choices[0].delta?.content || "";
            fullContent += contentPart;
            chrome.runtime.sendMessage({
              action: "stream_update",
              chunk: contentPart,
              id,
            });

            // Optionally update usage tokens if provided in this chunk.
            // Token counts unavailable in streaming
            if (parsed.usage) {
              totalInputTokens = parsed.usage.prompt_tokens;
              totalOutputTokens = parsed.usage.completion_tokens;
            }
          } catch (err) {
            console.error("Error parsing OpenAI stream chunk:", err);
          }
        }
      }
    }
  }
  return new AiResponse(fullContent, totalInputTokens, totalOutputTokens);
}

/**
 * Calls the Google Gemini API with streaming support.
 * @param {string} apiKey - The API key.
 * @param {string} modelName - The model name.
 * @param {string} prompt - The prompt.
 * @param {Array} chatHistory - The chat history.
 * @param {boolean} stream - Whether to stream the response.
 * @param {string} id - The message ID.
 * @returns {Promise<AiResponse>} The response.
 */
async function callGemini(apiKey, modelName, prompt, chatHistory, stream = false, id) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:${
      stream ? "streamGenerateContent" : "generateContent"
    }?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }] },
          ...chatHistory.map((msg) => ({
            role: { AI: "model", User: "user" }[msg.sender],
            parts: [{ text: msg.text }],
          })),
        ],
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API failed: ${response.status}`);

  if (!stream) {
    const data = await response.json();
    const generatedText =
      data.candidates
        ?.map((candidate) =>
          candidate.content?.parts?.map((part) => part.text).join("")
        )
        .join("") || "";
    return new AiResponse(
      generatedText,
      data.usageMetadata?.promptTokenCount || 0,
      data.usageMetadata?.candidatesTokenCount || 0
    );
  }

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
      if (!bufferedText && chunkText.startsWith("[")) chunkText = chunkText.slice(1);
      if (done && chunkText.endsWith("]%")) chunkText = chunkText.slice(0, -2);
      bufferedText += chunkText;
      // Separate individual JSON objects ({ candidates: [...] }) by unit
      let openBraces = 0;
      let startIndex = -1;
      for (let i = 0; i < bufferedText.length; i++) {
        if (bufferedText[i] === "{") {
          if (startIndex === -1) startIndex = i;
          openBraces++;
        } else if (bufferedText[i] === "}") {
          openBraces--;
          if (openBraces === 0) {
            const jsonStr = bufferedText.slice(startIndex, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              const generatedText =
                parsed.candidates?.[0].content?.parts?.map((part) => part.text).join("") || "";
              if (generatedText) {
                fullContent += generatedText;
                chrome.runtime.sendMessage({
                  action: "stream_update",
                  chunk: generatedText,
                  id,
                });
              }
              // Update token counts if available
              if (parsed.usageMetadata) {
                totalInputTokens += parsed.usageMetadata.promptTokenCount;
                totalOutputTokens += parsed.usageMetadata.candidatesTokenCount;
              }
              bufferedText = bufferedText.slice(i + 1).trim();
              i = -1;
              startIndex = -1;
            } catch (err) {
              console.warn("Failed to parse Gemini chunk, buffering:", bufferedText);
            }
          }
        }
      }
    }
  }
  return new AiResponse(fullContent, totalInputTokens, totalOutputTokens);
}

/**
 * Calls the Anthropic API with streaming support.
 * @param {string} apiKey - The API key.
 * @param {string} modelName - The model name.
 * @param {string} prompt - The prompt.
 * @param {Array} chatHistory - The chat history.
 * @param {boolean} stream - Whether to stream the response.
 * @param {string} id - The message ID.
 * @returns {Promise<AiResponse>} The response.
 */
async function callAnthropic(apiKey, modelName, prompt, chatHistory, stream = false, id) {
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
      system: prompt,
      messages: chatHistory.map((msg) => ({
        role: { AI: "assistant", User: "user" }[msg.sender],
        content: [{ type: "text", text: msg.text }],
      })),
      max_tokens: 300,
      stream,
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API failed: ${response.status}`);

  if (!stream) {
    const data = await response.json();
    const content = data.content[0].text;
    const usage = data.usage || {};
    return new AiResponse(content, usage.input_tokens || 0, usage.output_tokens || 0);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let fullContent = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      const chunkText = decoder.decode(value, { stream: !done });
      const lines = chunkText.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          try {
            let parsed = JSON.parse(dataStr);
            if (parsed.type === "message_start") parsed = parsed.message;
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              fullContent += parsed.delta.text;
              chrome.runtime.sendMessage({
                action: "stream_update",
                chunk: parsed.delta.text,
                id,
              });
            }
            // Optionally update token counts from message_delta events.
            if (parsed.usage) {
              totalInputTokens += parsed.usage.input_tokens || totalInputTokens;
              totalOutputTokens += parsed.usage.output_tokens || totalOutputTokens;
                          }
          } catch (err) {
            console.error("Error parsing Anthropic stream chunk:", err);
          }
        }
      }
    }
  }
  return new AiResponse(fullContent, totalInputTokens, totalOutputTokens);
}