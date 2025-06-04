import React, { useState } from 'react';
import { parseRoleAttributes, parseAccessibleDescriptions, parseIdeasBetweenRoles } from '../api';

function Parser({ roles }) {
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedTargetRole, setSelectedTargetRole] = useState(''); // For ideas parsing
  const [parseType, setParseType] = useState('attributes'); // 'attributes', 'accessible', 'ideas'
  const [parsedResult, setParsedResult] = useState([]);
  const [selectedLines, setSelectedLines] = useState({}); // To track selected lines for saving
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when roles list changes (e.g., role deleted)
  React.useEffect(() => {
      setSelectedRole('');
      setSelectedTargetRole('');
      setParsedResult([]);
      setSelectedLines({});
      setError(null);
  }, [roles]);


  const handleParse = async () => {
    if (!selectedRole) {
      alert('请选择一个角色进行解析');
      return;
    }

    setLoading(true);
    setParsedResult([]);
    setSelectedLines({});
    setError(null);

    try {
      let result = [];
      if (parseType === 'attributes') {
        result = await parseRoleAttributes(selectedRole);
      } else if (parseType === 'accessible') {
        result = await parseAccessibleDescriptions(selectedRole);
      } else if (parseType === 'ideas') {
          if (!selectedTargetRole) {
              alert('请选择想法的目标角色');
              setLoading(false);
              return;
          }
          result = await parseIdeasBetweenRoles(selectedRole, selectedTargetRole);
      }
      setParsedResult(result);
    } catch (err) {
      console.error("Parsing failed:", err);
      setError(`解析失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

   const handleCheckboxChange = (index) => {
    setSelectedLines(prevSelected => ({
      ...prevSelected,
      [index]: !prevSelected[index],
    }));
  };

  const handleSelectAll = () => {
      const allSelected = parsedResult.every((_, index) => selectedLines[index]);
      const newSelection = {};
      if (!allSelected) {
           parsedResult.forEach((_, index) => {
               newSelection[index] = true;
           });
      }
       setSelectedLines(newSelection);
  };

  const handleSaveSelected = () => {
    const selectedText = parsedResult
      .filter((_, index) => selectedLines[index])
      .join('\n');

    if (!selectedText) {
      alert('没有选中任何内容进行保存');
      return;
    }

    const blob = new Blob([selectedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedRole}-${parseType}-parsed.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
  };


  return (
    <div className="parser">
      <div>
        <label>选择角色: </label>
        <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
          <option value="">--选择角色--</option>
          {roles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>

       <div>
        <label>解析类型: </label>
        <select value={parseType} onChange={(e) => setParseType(e.target.value)}>
          <option value="attributes">自身属性描述</option>
          <option value="accessible">能访问到的其他角色描述</option>
          <option value="ideas">对其他角色的想法</option>
        </select>
           {parseType === 'ideas' && (
               <>
                 <label style={{marginLeft: '10px'}}>对角色: </label>
                  <select value={selectedTargetRole} onChange={(e) => setSelectedTargetRole(e.target.value)}>
                    <option value="">--选择目标角色--</option>
                     {roles.filter(r => r !== selectedRole).map(role => (
                         <option key={role} value={role}>{role}</option>
                     ))}
                  </select>
               </>
           )}
      </div>

      <button onClick={handleParse} disabled={loading || !selectedRole || (parseType === 'ideas' && !selectedTargetRole)}>
        {loading ? '解析中...' : '开始解析'}
      </button>

      {error && <p className="error">{error}</p>}

      {parsedResult.length > 0 && (
        <div className="parsed-output">
          <h3>解析结果:</h3>
            <div>
                 <button onClick={handleSelectAll}>全选/全不选</button>
                 <button onClick={handleSaveSelected} style={{marginLeft: '10px'}}>保存选中内容到文件</button>
            </div>
          <pre>
            {parsedResult.map((line, index) => (
              <div key={index} style={{marginBottom: '5px'}}>
                <input
                  type="checkbox"
                  checked={!!selectedLines[index]}
                  onChange={() => handleCheckboxChange(index)}
                  id={`line-${index}`}
                />
                <label htmlFor={`line-${index}`} style={{marginLeft: '5px', whiteSpace: 'pre-wrap'}}>{line}</label>
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

export default Parser;