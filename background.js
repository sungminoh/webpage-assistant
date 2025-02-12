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
`.trim(); // Default value


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt"], async (data) => {

      const modelType = request.model.type;
      if ((modelType == "openai" && !data.openaiApiKey)
        || (modelType == "anthropic" && !data.anthropicApiKey)) {
        console.error("API Key is missing.");
        chrome.runtime.sendMessage({ action: "summary_result", summary: "Error: API Key not set." });
        return;
      }

      // Combine chat history with the base prompt
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

Anser to the user's latest message.
`.trim();
        try {
          let summary;
          if (modelType === "openai") {
            summary = await callOpenAI(data.openaiApiKey, request.model.name, SYSTEM_PROMPT, prompt);
          } else if (modelType === "anthropic") {
            summary = await callAnthropic(data.anthropicApiKey, request.model.name, SYSTEM_PROMPT, prompt);
          }
          chrome.runtime.sendMessage({ action: "summary_result", summary });
        } catch (error) {
          console.error("Error calling OpenAI API:", error);
          chrome.runtime.sendMessage({
            action: "summary_result", summary: new AiResponse("Error: Failed to fetch summary.", 0, 0, 0)
          });
        }
      })
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

async function callOpenAI(apiKey, modelName, systemPrompt, userPrompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};
  return new AiResponse(content, usage.prompt_tokens || 0, usage.completion_tokens || 0);
}

async function callAnthropic(apiKey, modelName, systemPrompt, userPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      // Include the following header only if making requests from a browser environment:
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelName,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ],
      max_tokens: 300
    })
  });

  const data = await response.json();
  const content = data.content[0].text;
  const usage = data.usage || {};
  return new AiResponse(content, usage.input_tokens || 0, usage.output_tokens || 0);
}

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
  return new AiResponse(data.response, data.prompt_eval_count, data.eval_count); // Local models are free
}

// Listen for installed event to set default model
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ selectedModel: "gpt-4o" });
});



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "click_target_dom") {
    chrome.storage.local.set({ selectedHTML: message.html });
  }

  if (message.action === "open_popup") {
    chrome.action.openPopup();
  }
});

