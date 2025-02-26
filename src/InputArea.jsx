import { useState } from 'react';

export function InputArea({ modelSelector, onSubmit, onSave, selectModeActive, onToggleSelectMode }) {
  const [prompt, setPrompt] = useState('');

  const handleKeyUp = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!prompt.trim()) return;
      e.preventDefault();
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  const activateIcon = selectModeActive
    ? <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368"><path d="m500-120-56-56 142-142-142-142 56-56 142 142 142-142 56 56-142 142 142 142-56 56-142-142-142 142Zm-220 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/></svg>
    : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368"><path d="M440-120v-400h400v80H576l264 264-56 56-264-264v264h-80Zm-160 0v-80h80v80h-80Zm-80-640h-80q0-33 23.5-56.5T200-840v80Zm80 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80q33 0 56.5 23.5T840-760h-80ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm640 0v-80h80v80h-80Z"/></svg>;

  return (
    <div className="input-container">
      <div className="top-bar">
        <div className="left-controls">
          <div className="button-group">
            <button className="icon-btn" aria-label="Activate DOM selection"
              onClick={onToggleSelectMode}>
              {activateIcon}
            </button>
          </div>
        </div>

        <div className="model-container">
          {modelSelector}
        </div>

        <div className="right-controls">
          <div className="button-group">
            <button className="icon-btn" aria-label="Settings"
              onClick={() => chrome.runtime.openOptionsPage()}>
              <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
                <path
                  d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder="Enter your prompt..."
      />

      <div className="prompt-buttons button-group">
        <button className="icon-btn" aria-label="Save prompt"
          disabled={!prompt.trim()}
          onClick={() => { onSave(prompt.trim()); setPrompt(''); }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
            <path
              d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Z" />
          </svg>
        </button>
        <button className="icon-btn" aria-label="Send prompt"
          disabled={!prompt.trim()}
          onClick={() => { onSubmit(prompt.trim()); setPrompt(''); }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 -960 960 960">
            <path
              d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}