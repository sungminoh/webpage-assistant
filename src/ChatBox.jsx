// import { marked } from 'marked';

export function ChatBox({ messages, onClear }) {
  return (
    <div className="chat-container">
      <button className="page-corner" onClick={onClear}>
        Clear
      </button>
      <ul className="chat-box">
        {messages.map((msg, index) => (
          <li key={index} className={`message ${msg.sender.toLowerCase()}-message ${msg.isPlaceholder ? 'placeholder' : ''}`}>
            <div className="message-text-container">
              {/* <span dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }} /> */}
              <span dangerouslySetInnerHTML={{ __html: msg.text }} />
              {msg.usage && (
                <div className="usage-info">
                  <span>Input: {msg.usage.inputTokens}</span> |
                  <span>Output: {msg.usage.outputTokens}</span> |
                  <span>Price: ${msg.usage.totalPrice?.toFixed(4)}</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}