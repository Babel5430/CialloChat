import React from 'react';

// Reusing RoleList structure but renamed for clarity in this system
function RoleSelect({ roles, onSelectRole, selectedRole }) {
  return (
    <div className="role-select">
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