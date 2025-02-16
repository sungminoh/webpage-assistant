// src/modelManager.js
import { StorageHelper } from "./storageHelper.js";

class Model {
  constructor(type, name, inputPrice = 0, outputPrice = 0) {
    this.type = type;
    this.name = name;
    this.inputPrice = inputPrice;
    this.outputPrice = outputPrice;
  }

  serialize() {
    return btoa(JSON.stringify(this));
  }

  static deserialize(data) {
    try {
      return new Model(...Object.values(JSON.parse(atob(data))));
    } catch (error) {
      console.error("Model deserialization error:", error);
      return null;
    }
  }

  getPrice(inputTokens, outputTokens) {
    return ((this.inputPrice * inputTokens) + (this.outputPrice * outputTokens))
      / 1000000
  }
}

class ModelManager {
  static models = [];

  static async loadModels() {
    this.models = [
      ...this.getOpenAiModels(),
      ...this.getGeminiModels(),
      ...this.getAnthropicModels(),
      ...(await this.fetchOllamaModels())
    ];
    this.updateModelSelectOptions();
    await this.restoreSavedModel();
  }

  static getOpenAiModels() {
    return [
      new Model('openai', 'gpt-4o-mini', 0.15, 0.6),
      new Model('openai', 'gpt-3.5-turbo', 2, 2),
      new Model('openai', 'gpt-4o', 5, 15),
      new Model('openai', 'o1-mini', 7.5, 30),
      new Model('openai', 'o1-preview', 15, 60)
    ];
  }

  static getGeminiModels() {
    return [
      // Gemini 2.0 Models
      new Model('gemini', 'gemini-2.0-flash', 0.1, 0.4),
      new Model('gemini', 'gemini-2.0-flash-lite', 0.075, 0.3),
      // Gemini 1.5 Models
      new Model('gemini', 'gemini-1.5-pro', 0.3125, 5),  // 128k-plus, 0.625, 10
      new Model('gemini', 'gemini-1.5-flash', 0.075, 0.3),  // 128k-plus', 0.15, 0.6
    ];
  }

  static getAnthropicModels() {
    return [
      new Model('anthropic', 'claude-3-5-haiku-20241022', 0.25, 1.25),
      new Model('anthropic', 'claude-3-5-sonnet-20241022', 3, 15),
      new Model('anthropic', 'claude-3-opus-20240229', 15, 75)
    ];
  }

  static async fetchOllamaModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models.map(m => new Model('ollama', m.name, 0, 0)); // Local models are free
    } catch (error) {
      console.warn("Error fetching Ollama models:", error);
      return [];
    }
  }

  static updateModelSelectOptions() {
    const modelSelect = document.getElementById("modelSelect");
    if (!modelSelect) return;
    modelSelect.innerHTML = this.models.map(model => {
      const price =
        model.inputPrice === 0 && model.outputPrice === 0
          ? "Free"
          : `Input: $${model.inputPrice}/1M tokens, Output: $${model.outputPrice}/1M tokens`;
      return `<option value="${model.serialize()}">${model.name} (${model.type} - ${price})</option>`;
    }).join("");
  }

  static async restoreSavedModel() {
    const { selectedModel } = await StorageHelper.get(["selectedModel"]);
    if (selectedModel) {
      const modelSelect = document.getElementById("modelSelect");
      if (modelSelect) modelSelect.value = selectedModel;
    }
  }

  static saveSelectedModel() {
    const modelSelect = document.getElementById("modelSelect");
    if (modelSelect) {
      modelSelect.classList.remove("error");
      StorageHelper.set({ selectedModel: modelSelect.value });
    }
  }

  static getSelectedModel() {
    const modelSelect = document.getElementById("modelSelect");
    try {
      const selectedValue = modelSelect.value;
      return Model.deserialize(selectedValue);
    } catch (error) {
      modelSelect.classList.add("error");
      return null;
    }
  }

  static addEventListener() {
    const modelSelect = document.getElementById("modelSelect");
    modelSelect.addEventListener("change", this.saveSelectedModel);
  }
}

export { ModelManager, Model };