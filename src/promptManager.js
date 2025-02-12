// src/promptManager.js
import { StorageHelper } from "./storageHelper.js";
import { UIHelper } from "./uiHelper.js";
import { ContentProcessor } from "./contentProcessor.js";

class PromptManager {
  static async renderList(prompts) {
    const promptList = document.getElementById("promptList");
    if (!promptList) return;
    promptList.innerHTML = "";

    prompts.forEach((prompt, index) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = index;
      
      const dragHandle = UIHelper.createDragHandle();
      const promptText = UIHelper.createPromptText(prompt);
      const closeBtn = UIHelper.createCloseButton(async () => await this.cloasePrompt(index));

      li.append(dragHandle, promptText, closeBtn);
      promptList.appendChild(li);
    });

    this.initDragAndDrop();
    this.initClickHandlers(prompts);
  }

  static initClickHandlers(prompts) {
    const promptList = document.getElementById("promptList");
    if (!promptList) return;
    promptList.querySelectorAll("li").forEach((li, index) => {
      li.addEventListener("click", (event) => {
        // Prevent prompt submission when close button is clicked
        if (event.target.closest(".close-btn")) return;
        const customPromptInput = document.getElementById("customPrompt");
        if (customPromptInput) customPromptInput.value = prompts[index];
        // Submit the prompt when clicked
        ContentProcessor.submitPrompt(prompts[index]);
      });
    });
  }

  static initDragAndDrop() {
    const promptList = document.getElementById("promptList");
    if (!promptList) return;
    promptList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", li.dataset.index);
      });
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const fromIndex = e.dataTransfer.getData("text/plain");
        const toIndex = li.dataset.index;
        this.movePrompt(fromIndex, toIndex);
      });
    });
  }

  static async movePrompt(fromIndex, toIndex) {
    fromIndex = parseInt(fromIndex);
    toIndex = parseInt(toIndex);
    const { savedPrompts = [] } = await StorageHelper.get(["savedPrompts"], "sync");
    if (fromIndex === toIndex || !savedPrompts.length) return;
    const [movedItem] = savedPrompts.splice(fromIndex, 1);
    savedPrompts.splice(toIndex, 0, movedItem);
    await StorageHelper.set({ savedPrompts }, "sync");
    this.renderList(savedPrompts);
  }

  static async cloasePrompt(index) {
    const promptItems = document.querySelectorAll("#promptList li");
    if (promptItems[index]) {
      promptItems[index].classList.add("fade-out");
      setTimeout(async () => {
        const { savedPrompts = [] } = await StorageHelper.get(["savedPrompts"], "sync");
        savedPrompts.splice(index, 1);
        await StorageHelper.set({ savedPrompts }, "sync");
        this.renderList(savedPrompts);
      }, 300);
    }
  }
}

export { PromptManager };