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
          const summary = await summarizeText(data.openaiApiKey, request.model, systemPrompt, userPrompt);
          chrome.runtime.sendMessage({ action: "summary_result", summary });
        } catch (error) {
          console.error("Error calling OpenAI API:", error);
          chrome.runtime.sendMessage({ action: "summary_result", summary: "Error: Failed to fetch summary." });
        }
      })
    });
  }
});

async function summarizeText(apiKey, model, systemPrompt, userPrompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 400
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Listen for installed event to set default model
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ selectedModel: "gpt-4o" });
});
