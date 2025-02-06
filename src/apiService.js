// src/apiService.js
import { API_CONFIG, DEFAULT_SYSTEM_PROMPT } from "./constants.js";

export class ApiService {
  static async callOpenAI(apiKey, modelName, userPrompt) {
    const response = await fetch(API_CONFIG.OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: DEFAULT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ]
      })
    });
    const data = await response.json();
    const content = data.choices[0].message.content;
    const usage = data.usage || {};
    return { content, inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0 };
  }

  static async callAnthropic(apiKey, modelName, userPrompt) {
    const response = await fetch(API_CONFIG.ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: modelName,
        system: DEFAULT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 300
      })
    });
    const data = await response.json();
    const content = data.content[0].text;
    const usage = data.usage || {};
    return { content, inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 };
  }
}