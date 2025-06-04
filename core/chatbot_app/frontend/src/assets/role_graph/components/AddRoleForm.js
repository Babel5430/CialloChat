import React, { useState } from 'react';

function AddRoleForm({ onRoleAdded }) {
  const [newRoleName, setNewRoleName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newRoleName.trim()) {
      onRoleAdded(newRoleName.trim());
      setNewRoleName('');
    }
  };

  return (
    <div className="add-role-form">
      <h3>添加新角色</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="新角色名称"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
        />
        <button type="submit">添加角色</button>
      </form>
    </div>
  );
}

export default AddRoleForm;