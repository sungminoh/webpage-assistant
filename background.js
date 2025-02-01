chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    chrome.storage.sync.get(["openaiApiKey", "anthropicApiKey", "basePrompt", "chatHistory"], async (data) => {

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
        const systemPrompt = `${data.basePrompt}\n\nWebpage:\n${request.content}`;

        const userPrompt = `${historyText}`;
        console.log("System Prompt:", systemPrompt);
        console.log("User Prompt:", userPrompt);

        try {
          let summary;
          if (modelType === "openai") {
            summary = await callOpenAI(data.openaiApiKey, request.model.name, systemPrompt, userPrompt);
          } else if (modelType === "anthropic") {
            console.log(data)
            summary = await callAnthropic(data.anthropicApiKey, request.model.name, systemPrompt, userPrompt);
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
  console.log(message)
  if (message.action === "open_floating_popup") {
    chrome.storage.local.set({ selectedHTML: message.html });
  }
});


let loaded = false;

chrome.action.onClicked.addListener((tab) => {
  if (!loaded) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content.css", "popup.css", "popup.js"]
    });

    loaded = true; // Ensure it only loads once
  }
});