export function PromptList({ prompts, onSelect, onDelete, onReorder }) {
    const handleDragStart = (e, index) => {
      e.dataTransfer.setData('text/plain', index);
    };
  
    const handleDrop = (e, toIndex) => {
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      onReorder(fromIndex, toIndex);
    };
  
    return (
      <ul className="prompt-list">
        {prompts.map((prompt, index) => (
          <li
            key={index}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, index)}
          >
            <span onClick={() => onSelect(prompt)}>{prompt}</span>
            <button onClick={() => onDelete(index)}>Delete</button>
          </li>
        ))}
      </ul>
    );
  }