import { useState } from 'react';
import { useChat, useModels, usePrompts, useDomSelection, ThemeProvider } from './hooks';
import { ChatBox } from './ChatBox';
import { InputArea } from './InputArea';
import { ModelSelector } from './ModelSelector';
import { PromptList } from './PromptList';
import { DomSelector } from './DomSelector';
import { contentProcessor } from './contentProcessor'; // Keep existing singleton for now

function App() {
  const { chatHistory, addMessage, clearChat } = useChat();
  const { models, selectedModel, setSelectedModel } = useModels();
  const { prompts, addPrompt, removePrompt, reorderPrompts } = usePrompts();
  const { selectModeActive, selectedHTML, toggleSelectMode } = useDomSelection();

  const handleSubmitMessage = (prompt) => {
    addMessage('User', prompt);
    const msgId = addMessage("AI", "AI is thinking...", null, true);
    contentProcessor.submitPrompt(msgId, selectedModel, selectedHTML); // Reuse existing logic
  };

  const handleSavePrompt = (prompt) => {
    addPrompt(prompt);
  };

  const modelSelector = <ModelSelector models={models} selectedModel={selectedModel} onSelect={setSelectedModel} />

  return (
    <ThemeProvider>
      <div className="app">
        <ChatBox messages={chatHistory} onClear={clearChat} />
        <InputArea
          modelSelector={modelSelector}
          onSubmit={handleSubmitMessage}
          onSave={handleSavePrompt}
          selectModeActive={selectModeActive}
          onToggleSelectMode={toggleSelectMode}
        />
        <PromptList
          prompts={prompts}
          onSelect={handleSubmitMessage}
          onDelete={removePrompt}
          onReorder={reorderPrompts}
        />
        <DomSelector selectedHTML={selectedHTML} />
      </div>
    </ThemeProvider>
  );
}

export default App;