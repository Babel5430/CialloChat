import React from 'react';
function InputArea({ userInput, setUserInput, onSend, disabled }) {
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !disabled) {
      onSend();
    }
  };
  return (
    <div className="input-section">
      <input
        type="text"
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="请输入信息..."
        disabled={disabled}
      />
      <button onClick={onSend} disabled={disabled}>
        Send
      </button>
    </div>
  );
}

export default InputArea;