import React, { useState, useEffect } from 'react';

function AnswerManager({ roleName, selectedInput, answers, onAddAnswer, onUpdateAnswer, onDeleteAnswer }) {
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [editingIndex, setEditingIndex] = useState(null); // null for add, index for edit

  // Reset form when selected input changes
  useEffect(() => {
    setCurrentAnswer('');
    setEditingIndex(null);
  }, [selectedInput]);

  if (!selectedInput) {
    return (
      <div className="answer-manager">
        <h3>标准回答</h3>
        <p>请从左侧选择一个标准输入。</p>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentAnswer.trim()) {
      alert('标准回答内容不能为空');
      return;
    }

    if (editingIndex === null) { // Add mode
       // Check for duplicates handled by backend API
       onAddAnswer(selectedInput, currentAnswer.trim());
    } else { // Edit mode
       onUpdateAnswer(selectedInput, editingIndex, currentAnswer.trim());
    }

    // Clear form and reset to add mode
    setCurrentAnswer('');
    setEditingIndex(null);
  };

  const handleEditClick = (index, answerText) => {
    setCurrentAnswer(answerText);
    setEditingIndex(index);
  };

   const handleCancelEdit = () => {
       setCurrentAnswer('');
       setEditingIndex(null);
   };


  return (
    <div className="answer-manager">
      <h3>标准回答 ({answers.length})</h3>
      <h4>针对输入: "{selectedInput}"</h4>

      <div className="answer-list">
        {answers.length > 0 ? (
          <ul>
            {answers.map((answer, index) => (
              <li key={index}>
                <span className="answer-text">{answer}</span>
                <span className="actions">
                  <button onClick={() => handleEditClick(index, answer)}>编辑</button>
                  <button onClick={() => onDeleteAnswer(selectedInput, index)}>删除</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>(无标准回答)</p>
        )}
      </div>

      <div className="add-edit-form">
        <h5>{editingIndex !== null ? '编辑标准回答' : '添加新标准回答'}:</h5>
         <form onSubmit={handleSubmit}>
           <div>
             <textarea
               value={currentAnswer}
               onChange={(e) => setCurrentAnswer(e.target.value)}
               placeholder="输入标准回答..."
               rows="3"
               required
             />
           </div>
           <button type="submit">{editingIndex !== null ? '更新回答' : '添加回答'}</button>
            {editingIndex !== null && (
                <button type="button" onClick={handleCancelEdit} style={{marginLeft: '10px', backgroundColor: '#6c757d'}}>取消编辑</button>
            )}
         </form>
      </div>

    </div>
  );
}

export default AnswerManager;