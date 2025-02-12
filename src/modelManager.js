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
}

class ModelManager {
  static models = [];

  static async loadModels() {
    this.models = [
      ...this.getOpenAiModels(),
      ...this.getAnthropicModels(),
      ...(await this.fetchOllamaModels())
    ];
    this.updateModelSelectOptions();
    await this.restoreSavedModel();
  }

  static getOpenAiModels() {
    return [
      new Model('openai', 'gpt-4o-mini', 0.00015, 0.0006),
      new Model('openai', 'gpt-3.5-turbo', 0.002, 0.002),
      new Model('openai', 'gpt-4o', 0.005, 0.015),
      new Model('openai', 'o1-mini', 0.0075, 0.03),
      new Model('openai', 'o1-preview', 0.015, 0.06)
    ];
  }

  static getAnthropicModels() {
    return [
      new Model('anthropic', 'claude-3-5-haiku-20241022', 0.00025, 0.00125),
      new Model('anthropic', 'claude-3-5-sonnet-20241022', 0.003, 0.015),
      new Model('anthropic', 'claude-3-opus-20240229', 0.015, 0.075)
    ];
  }

  static async fetchOllamaModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models.map(m => new Model('ollama', m.name, 0, 0)); // Local models are free
    } catch (error) {
      console.error("Error fetching Ollama models:", error);
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
          : `Input: $${model.inputPrice}/1K tokens, Output: $${model.outputPrice}/1K tokens`;
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
}

export { ModelManager, Model };