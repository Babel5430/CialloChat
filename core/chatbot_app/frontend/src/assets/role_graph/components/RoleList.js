import React from 'react';

function RoleList({ roles, onSelectRole, selectedRole, onDeleteRole }) {

    const handleDeleteClick = (e, role) => {
        e.stopPropagation(); // Prevent selecting the role when deleting
        if (window.confirm(`确定删除角色 "${role}" 吗？`)) {
            onDeleteRole(role);
        }
    };

  return (
    <div className="role-list">
      <h3>角色列表 ({roles.length})</h3>
      <ul>
        {roles.map(role => (
          <li
            key={role}
            onClick={() => onSelectRole(role === selectedRole ? null : role)}
            className={selectedRole === role ? 'selected' : ''}
          >
            {role}
            <button onClick={(e) => handleDeleteClick(e, role)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RoleList;