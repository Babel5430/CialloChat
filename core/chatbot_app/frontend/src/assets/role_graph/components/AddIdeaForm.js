import React, { useState } from 'react';

function AddIdeaForm({ sourceRole, onIdeaAdded, allRoles }) {
  const [targetRole, setTargetRole] = useState('');
  const [ideaText, setIdeaText] = useState('');

  React.useEffect(() => {
      setTargetRole('');
      setIdeaText('');
  }, [sourceRole]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetRole || !ideaText.trim()) {
      alert('请选择目标角色并填写想法内容');
      return;
    }
    onIdeaAdded(sourceRole, targetRole, ideaText.trim());
    setTargetRole('');
    setIdeaText('');
  };

  return (
    <div className="add-idea-form">
      <form onSubmit={handleSubmit}>
        <div>
            <label>想法指向: </label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} required>
                <option value="">--选择目标角色--</option>
                {allRoles.filter(role => role !== sourceRole).map(role => (
                    <option key={role} value={role}>{role}</option>
                ))}
            </select>
        </div>
        <div>
            <label>想法内容: </label>
            <textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                required
             />
        </div>
        <button type="submit">添加想法</button>
      </form>
    </div>
  );
}

export default AddIdeaForm;