chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    chrome.storage.sync.get(["openaiApiKey", "basePrompt", "chatHistory"], async (data) => {
      if (!data.openaiApiKey) {
        console.error("API Key is missing.");
        chrome.runtime.sendMessage({ action: "summary_result", summary: "Error: API Key not set." });
        return;
      }

      // Combine chat history with the base prompt
      chrome.storage.local.get(["chatHistory"], async (historyData) => {
        let chatHistory = historyData.chatHistory || [];
        let historyText = chatHistory.map(entry => `${entry.sender}: ${entry.text}`).join("\n");
        const systemPrompt = `${data.basePrompt}\n\nWebpage:\n${request.content}`;

        const userPrompt = `${historyText}\nUser: ${request.prompt}`;
        console.log("System Prompt:", systemPrompt);
        console.log("User Prompt:", userPrompt);

        try {
          const summary = await askAi(data.openaiApiKey, request.model, systemPrompt, userPrompt);
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

async function askAi(apiKey, model, systemPrompt, userPrompt) {
  if (model.type === 'openai') {
    return await callOpenAI(apiKey, model.name, systemPrompt, userPrompt);
  } else if (model.type === 'ollama') {
    return await callOllama(model.name, systemPrompt, userPrompt);
  }

  throw new Error(`Unsupported model type: ${model.type}`);
}

// Listen for installed event to set default model
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ selectedModel: "gpt-4o" });
});
