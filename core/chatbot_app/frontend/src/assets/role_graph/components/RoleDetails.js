import React, { useState } from 'react';

// Add new props for delete handlers
function RoleDetails({ roleData, roleName, onDeleteAttribute, onDeleteDescription, onDeleteIdeasToRole, onDeleteSpecificIdea }) {
  const [expandedAttributes, setExpandedAttributes] = useState({});
  const toggleAttribute = (attrName) => {
    setExpandedAttributes(prev => ({
      ...prev,
      [attrName]: !prev[attrName]
    }));
  };

  if (!roleData) {
    return <p>请选择一个角色。</p>;
  }

  const { attributes, ideas } = roleData;

  return (
    <div className="role-details">
      <h4>属性:</h4>
{attributes && Object.keys(attributes).length > 0 ? (
        <ul>
          {Object.entries(attributes).map(([attrName, descriptions]) => (
            <li key={attrName}>
              <div className="attribute-header" onClick={() => toggleAttribute(attrName)}>
                <span className="attribute-toggle">
                  {expandedAttributes[attrName] ? '▼' : '▶'}
                </span>
                <strong>{attrName}</strong>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    onDeleteAttribute(roleName, attrName);
                  }} 
                  style={{marginLeft: '10px', backgroundColor: '#dc3545', padding: '3px 8px', fontSize: '0.8em'}}
                >
                  删除属性
                </button>
              </div>
              {expandedAttributes[attrName] && (
                <div className="attribute-content"> 
                  <ul>
                    {descriptions.map((desc, index) => (
                      <li key={index} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                         <span style={{flexGrow: 1, marginRight: '10px', wordBreak: 'break-word'}}>
                            "{desc.description}" (访问权: {Array.isArray(desc.access_rights) ? desc.access_rights.join(', ') : desc.access_rights})
                         </span>
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteDescription(roleName, attrName, index);
                            }}
                            style={{backgroundColor: '#dc3545', padding: '3px 8px', fontSize: '0.8em'}}
                         >
                            删除描述
                         </button>
                      </li>
                    ))}
                  </ul>
                </div> 
              )} 
            </li>
          ))}
        </ul>
      ) : (
        <p>(无属性)</p>
      )}

      <h4>想法:</h4>
       {ideas && Object.keys(ideas).length > 0 ? (
        <ul>
          {Object.entries(ideas).map(([targetRole, ideasList]) => (
            <li key={targetRole}>
              <strong>对 {targetRole} 的想法:</strong>
              <button onClick={() => onDeleteIdeasToRole(roleName, targetRole)} style={{marginLeft: '10px', backgroundColor: '#dc3545', padding: '3px 8px', fontSize: '0.8em'}}>删除所有想法</button>
               <ul>
                  {ideasList.map((idea, index) => (
                     <li key={index} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                         <span style={{flexGrow: 1, marginRight: '10px', wordBreak: 'break-word'}}>"{idea}"</span>
                         <button onClick={() => onDeleteSpecificIdea(roleName, targetRole, index)} style={{backgroundColor: '#dc3545', padding: '3px 8px', fontSize: '0.8em'}}>删除此想法</button>
                     </li>
                  ))}
               </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p>(无想法)</p>
      )}
    </div>
  );
}

export default RoleDetails;