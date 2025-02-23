import { useState } from 'react';
import { useChat, useModels, usePrompts, useDomSelection, ThemeProvider } from './hooks';
import { ChatBox } from './ChatBox';
import { InputArea } from './InputArea';
import { ModelSelector } from './ModelSelector';
import { PromptList } from './PromptList';
import { DomSelector } from './DomSelector';
import { SettingsButton } from './SettingsButton';
import { contentProcessor } from './contentProcessor'; // Keep existing singleton for now

function App() {
  const { chatHistory, addMessage, clearChat } = useChat();
  const { models, selectedModel, setSelectedModel } = useModels();
  const { prompts, addPrompt, removePrompt, reorderPrompts } = usePrompts();
  const { active, selectedHTML, toggle } = useDomSelection();

  const handleSubmitPrompt = (prompt) => {
    addMessage('User', prompt);
    contentProcessor.submitPrompt(prompt, selectedModel, selectedHTML); // Reuse existing logic
  };

  const handleSavePrompt = (prompt) => {
    addPrompt(prompt);
  };

  return (
    <ThemeProvider>
      <div className="app">
        <ModelSelector models={models} selectedModel={selectedModel} onSelect={setSelectedModel} />
        <ChatBox messages={chatHistory} onClear={clearChat} />
        <InputArea onSubmit={handleSubmitPrompt} onSave={handleSavePrompt} />
        <PromptList
          prompts={prompts}
          onSelect={handleSubmitPrompt}
          onDelete={removePrompt}
          onReorder={reorderPrompts}
        />
        <DomSelector active={active} selectedHTML={selectedHTML} onToggle={toggle} />
        <SettingsButton />
      </div>
    </ThemeProvider>
  );
}

export default App;