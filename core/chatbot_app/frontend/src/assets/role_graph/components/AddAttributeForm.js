import React, { useState } from 'react';

function AddAttributeForm({ roleName, sourceRole, onAttributeDescriptionAdded, allRoles, isAddingForOtherRole }) {
  const [attributeName, setAttributeName] = useState('');
  const [description, setDescription] = useState('');
  const [accessRights, setAccessRights] = useState('unlimited'); // 'unlimited', 'selected', or null for default
  const [selectedAccessRoles, setSelectedAccessRoles] = useState([]);
  const [targetRole, setTargetRole] = useState(''); // For adding descriptions to other roles

  // Reset form when selected role or mode changes
  React.useEffect(() => {
    setAttributeName('');
    setDescription('');
    setAccessRights('unlimited');
    setSelectedAccessRoles([]);
    setTargetRole('');
  }, [roleName, isAddingForOtherRole]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!attributeName.trim() || !description.trim()) {
      alert('属性名称和描述不能为空');
      return;
    }

    let finalAccessRights = null; // Use null to let backend default

    if (!isAddingForOtherRole) {
      // Adding description to the selected role itself
      if (accessRights === 'unlimited') {
        finalAccessRights = 'unlimited';
      } else if (accessRights === 'selected') {
        finalAccessRights = selectedAccessRoles;
      }
      onAttributeDescriptionAdded(roleName, attributeName.trim(), description.trim(), finalAccessRights);

    } else {
      // Adding description from sourceRole for targetRole
      if (!targetRole) {
        alert('请选择要添加描述的目标角色');
        return;
      }
      // Access rights will be defaulted to [sourceRole] in the backend API
      onAttributeDescriptionAdded(sourceRole, targetRole, attributeName.trim(), description.trim());
    }


    // Clear form
    setAttributeName('');
    setDescription('');
    setAccessRights('unlimited');
    setSelectedAccessRoles([]);
    if (isAddingForOtherRole) {
      setTargetRole('');
    }
  };

  const handleAccessRightChange = (e) => {
    setAccessRights(e.target.value);
    if (e.target.value !== 'selected') {
      setSelectedAccessRoles([]);
    }
  }

  const handleSelectedAccessRolesChange = (e) => {
    const options = e.target.options;
    const value = [];
    for (let i = 0, l = options.length; i < l; i++) {
      if (options[i].selected) {
        value.push(options[i].value);
      }
    }
    setSelectedAccessRoles(value);
  };


  return (
    <div className="add-attribute-form">
      <form onSubmit={handleSubmit}>
        {isAddingForOtherRole && (
          <div>
            <label>为角色: </label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} required>
              <option value="">--选择目标角色--</option>
              {allRoles.filter(r => r !== sourceRole).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label>属性名称: </label>
          <input
            type="text"
            value={attributeName}
            onChange={(e) => setAttributeName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>描述: </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {!isAddingForOtherRole && ( // Only show access rights selection when adding to the selected role itself
          <div>
            <label>访问权: </label>
            <select value={accessRights} onChange={handleAccessRightChange}>
              <option value="unlimited">不限 (所有角色)</option>
              <option value="default">默认 (空列表，后端处理)</option> {/* Option removed, backend handles null */}
              <option value="selected">指定角色</option>
            </select>
            {accessRights === 'selected' && (
              <select multiple value={selectedAccessRoles} onChange={handleSelectedAccessRolesChange}>
                {allRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            )}
          </div>
        )}


        <button type="submit">添加描述</button>
      </form>
    </div>
  );
}

export default AddAttributeForm;