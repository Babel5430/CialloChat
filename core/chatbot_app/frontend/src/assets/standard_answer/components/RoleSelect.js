import React from 'react';

function RoleSelect({ roles, onSelectRole, selectedRole }) {
  return (
    <div className="role-select">
      <h3>角色列表 ({roles.length})</h3> {/* Add heading */}
      <ul>
        {roles.map(role => (
          <li
            key={role}
            onClick={() => onSelectRole(role === selectedRole ? null : role)}
            className={selectedRole === role ? 'selected' : ''}
          >
            {role}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RoleSelect;