import React, { useState, useEffect } from 'react';

function InputManager({ roleName, qnaData, selectedInput, onSelectInput, onAddInput, onUpdateInput, onDeleteInput }) {
  const [currentInput, setCurrentInput] = useState('');
  const [editingInput, setEditingInput] = useState(null); // null for add, string for edit

  // Reset form when role changes
  useEffect(() => {
    setCurrentInput('');
    setEditingInput(null);
  }, [roleName]);

  // Reset selected input when role or qnaData changes (e.g. after delete)
  useEffect(() => {
       if (selectedInput !== null && !(selectedInput in qnaData)) {
           onSelectInput(null); // Deselect if the input was deleted
       }
  }, [qnaData, selectedInput, onSelectInput]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentInput.trim()) {
      alert('标准输入内容不能为空');
      return;
    }

    if (editingInput === null) { // Add mode
       // Check for duplicates handled by backend API
       onAddInput(currentInput.trim());
    } else { // Edit mode
       onUpdateInput(editingInput, currentInput.trim());
    }

    // Clear form and reset to add mode
    setCurrentInput('');
    setEditingInput(null);
  };

  const handleEditClick = (input) => {
    setCurrentInput(input);
    setEditingInput(input);
  };

   const handleCancelEdit = () => {
       setCurrentInput('');
       setEditingInput(null);
   };

  const inputs = Object.keys(qnaData);

  return (
    <div className="input-manager">
      <h3>标准输入 ({inputs.length})</h3>
      <div className="input-list">
        {inputs.length > 0 ? (
          <ul>
            {inputs.map(input => (
              <li
                key={input}
                onClick={() => onSelectInput(input === selectedInput ? null : input)}
                className={selectedInput === input ? 'selected' : ''}
              >
                <span className="input-text">{input}</span>
                <span className="actions">
                    <button onClick={(e) => { e.stopPropagation(); handleEditClick(input); }}>编辑</button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteInput(input); }}>删除</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>(无标准输入)</p>
        )}
      </div>

       <div className="add-edit-form">
           <h5>{editingInput !== null ? '编辑标准输入' : '添加新标准输入'}:</h5>
            <form onSubmit={handleSubmit}>
              <div>
                <textarea
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="输入标准输入..."
                  rows="2"
                  required
                />
              </div>
              <button type="submit">{editingInput !== null ? '更新输入' : '添加输入'}</button>
              {editingInput !== null && (
                  <button type="button" onClick={handleCancelEdit} style={{marginLeft: '10px', backgroundColor: '#6c757d'}}>取消编辑</button>
              )}
            </form>
       </div>

    </div>
  );
}

export default InputManager;