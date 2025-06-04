import React, { useState, useEffect } from 'react';

function QueryManager({ roleName, concept, queries, onAddOrUpdateQuery, onDeleteQuery }) {
  const [currentQuery, setCurrentQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState(null); // null for add, index for edit

  // Reset form when concept or role changes
  useEffect(() => {
    setCurrentQuery('');
    setEditingIndex(null);
  }, [roleName, concept]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentQuery.trim()) {
      alert('查询语句内容不能为空');
      return;
    }

    // Check if query already exists (unless editing the exact same entry)
     const existingIndex = queries.findIndex((q, i) => q === currentQuery.trim() && i !== editingIndex);
     if (existingIndex !== -1) {
         alert('查询语句内容已存在!');
         return;
     }


    onAddOrUpdateQuery(concept, currentQuery.trim(), editingIndex); // Pass concept, query, and index
    setCurrentQuery('');
    setEditingIndex(null); // Reset form to add mode
  };

  const handleEditClick = (index, queryText) => {
    setCurrentQuery(queryText);
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
      setCurrentQuery('');
      setEditingIndex(null);
  }


  return (
    <div className="query-manager">
      <h4>可查询项: {concept}</h4>

      <div className="query-list">
        <h5>现有查询语句 ({queries.length}):</h5>
        {queries.length > 0 ? (
          <ul>
            {queries.map((query, index) => (
              <li key={index}>
                <span className="query-text">{query}</span>
                <span className="actions">
                  <button onClick={() => handleEditClick(index, query)}>编辑</button>
                  <button onClick={() => onDeleteQuery(concept, index)}>删除</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>(无查询语句)</p>
        )}
      </div>

      <div className="add-edit-form">
        <h5>{editingIndex !== null ? '编辑查询语句' : '添加新查询语句'}:</h5>
        <form onSubmit={handleSubmit}>
          <div>
            <textarea
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              placeholder="输入自然语言查询语句..."
              rows="3"
              required
            />
          </div>
          <button type="submit">{editingIndex !== null ? '更新语句' : '添加语句'}</button>
           {editingIndex !== null && (
               <button type="button" onClick={handleCancelEdit} style={{marginLeft: '10px', backgroundColor: '#6c757d'}}>取消编辑</button>
           )}
        </form>
      </div>
    </div>
  );
}

export default QueryManager;