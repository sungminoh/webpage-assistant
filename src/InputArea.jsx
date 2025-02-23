import { useState } from 'react';

export function InputArea({ onSubmit, onSave }) {
  const [prompt, setPrompt] = useState('');

  const handleKeyUp = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="input-area">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder="Enter your prompt..."
      />
      <button onClick={() => { onSave(prompt); setPrompt(''); }}>Save</button>
      <button onClick={() => { onSubmit(prompt); setPrompt(''); }}>Submit</button>
    </div>
  );
}