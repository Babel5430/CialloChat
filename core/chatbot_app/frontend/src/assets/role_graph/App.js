import React, { useState, useEffect } from 'react';
import { fetchGraph, fetchRoles, addRole, deleteRole, addAttributeDescription, addIdea, addDescriptionForOtherRole, saveGraph,
  deleteAttribute, deleteDescription, deleteIdeasToRole, deleteSpecificIdea 
} from './api';
import RoleList from './components/RoleList';
import RoleDetails from './components/RoleDetails';
import AddRoleForm from './components/AddRoleForm';
import AddAttributeForm from './components/AddAttributeForm';
import AddIdeaForm from './components/AddIdeaForm';
import Parser from './components/Parser';
import GraphVisualization from './components/GraphVisualization';
import './App.css'; 

function App() {
  const [graph, setGraph] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); 

    const handleError = (err, operation) => {
    console.error(`Error ${operation}:`, err);
    let displayMessage = `Error ${operation}: ${err.message}`;
    if (err.message && typeof err.message === 'string') { 
    }
    setError(displayMessage);
  };
  const loadGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const graphData = await fetchGraph();
      setGraph(graphData);
      setRoles(Object.keys(graphData.roles || {}));
    } catch (err) {
      handleError(err, "loading graph data");
      // setError("Failed to load graph data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, [refreshKey]); // Reload graph data when refreshKey changes

  const handleRoleAdded = async (roleName) => {
    try {
      await addRole(roleName);
      setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
    } catch (err) {
      // console.error("Error adding role:", err);
      // setError(`Error adding role: ${err.message}`);
      handleError(err, "adding role");
    }
  };

  const handleRoleDeleted = async (roleName) => {
    try {
      await deleteRole(roleName);
      setSelectedRole(null); // Deselect deleted role
      setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
    } catch (err) { 
      // console.error("Error deleting role:", err);
      // setError(`Error deleting role: ${err.message}`);
      handleError(err, "deleting role");
    }
  };

  const handleAttributeDescriptionAdded = async (roleName, attributeName, description, accessRights) => {
    try {
      await addAttributeDescription(roleName, attributeName, description, accessRights);
      setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
    } catch (err) {
      // console.error("Error adding attribute description:", err);
      // setError(`Error adding attribute description: ${err.message}`);
      handleError(err, "adding attribute description");
    }
  };

   const handleIdeaAdded = async (sourceRole, targetRole, idea) => {
    try {
      await addIdea(sourceRole, targetRole, idea);
      setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload 
    } catch (err) {
      // console.error("Error adding idea:", err);
      // setError(`Error adding idea: ${err.message}`);
      handleError(err, "adding idea");
    }
  };

   const handleDescriptionForOtherRoleAdded = async (sourceRole, targetRole, attributeName, description) => {
    try {
      await addDescriptionForOtherRole(sourceRole, targetRole, attributeName, description);
       setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
    } catch (err) {
      // console.error("Error adding description for other role:", err);
      // setError(`Error adding description for other role: ${err.message}`);
      handleError(err, "adding description for other role");
    }
  };

  const handleSaveGraph = async () => {
    try {
      await saveGraph();
      alert("Graph saved successfully!");
    } catch (err) {
      // console.error("Error saving graph:", err);
      // setError(`Error saving graph: ${err.message}`);
      handleError(err, "saving graph");
      alert(`Error saving graph: ${err.message}`);
    }
  }

  const handleDeleteAttribute = async (roleName, attributeName) => {
    if (window.confirm(`确定删除角色 "${roleName}" 的整个属性 "${attributeName}" 及其所有描述吗？`)) {
        try {
            await deleteAttribute(roleName, attributeName);
            setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
             alert(`属性 "${attributeName}" 已删除!`);
        } catch (err) {
            //  console.error("Error deleting attribute:", err);
            //  setError(`删除属性失败: ${err.message}`);
            handleError(err, `deleting attribute "${attributeName}"`);
            alert(`删除属性失败: ${err.message}`);
        }
    }
};

 const handleDeleteDescription = async (roleName, attributeName, index) => {
     if (window.confirm(`确定删除角色 "${roleName}" 的属性 "${attributeName}" 中的这条描述吗？`)) {
          try {
              await deleteDescription(roleName, attributeName, index);
              setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
              alert(`属性描述已删除!`);
          } catch (err) {
              // console.error("Error deleting description:", err);
              // setError(`删除属性描述失败: ${err.message}`);
              handleError(err, `deleting description for attribute "${attributeName}"`);
              alert(`删除属性描述失败: ${err.message}`);
          }
     }
 };

 const handleDeleteIdeasToRole = async (sourceRole, targetRole) => {
     if (window.confirm(`确定删除角色 "${sourceRole}" 对角色 "${targetRole}" 的所有想法吗？`)) {
         try {
              await deleteIdeasToRole(sourceRole, targetRole);
               setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
               alert(`对角色 "${targetRole}" 的所有想法已删除!`);
         } catch (err) {
              // console.error("Error deleting ideas to role:", err);
              // setError(`删除想法失败: ${err.message}`);
              handleError(err, `deleting all ideas from "${sourceRole}" to "${targetRole}"`);
              alert(`删除想法失败: ${err.message}`);
         }
     }
 };

  const handleDeleteSpecificIdea = async (sourceRole, targetRole, index) => {
      if (window.confirm(`确定删除角色 "${sourceRole}" 对角色 "${targetRole}" 的这条想法吗？`)) {
          try {
              await deleteSpecificIdea(sourceRole, targetRole, index);
              setRefreshKey(oldKey => oldKey + 1); // Trigger graph reload
              alert(`特定想法已删除!`);
          } catch (err) {
              // console.error("Error deleting specific idea:", err);
              // setError(`删除想法失败: ${err.message}`);
              handleError(err, `deleting specific idea from "${sourceRole}" to "${targetRole}"`);
              alert(`删除想法失败: ${err.message}`);
          }
      }
  };


  return (
    <div className="App">
      <header className="App-header">
        <h1>角色图谱管理系统</h1>
        <button onClick={handleSaveGraph}>手动保存图谱</button>
      </header>
      {loading && <p>加载中...</p>}
      {error && <p className="error">{error}</p>}

      <div className="container">
        <div className="sidebar">
           <AddRoleForm onRoleAdded={handleRoleAdded} />
           {roles.length > 0 && (
              <RoleList roles={roles} onSelectRole={setSelectedRole} selectedRole={selectedRole} onDeleteRole={handleRoleDeleted}/>
           )}
        </div>
        <div className="main-content">
            <div className="details-panel">
                <h2>角色详情 & 编辑</h2>
                {selectedRole ? (
                    <>
                        <h3>当前选中: {selectedRole}</h3>
                        <RoleDetails
                           roleData={graph?.roles?.[selectedRole]}
                           roleName={selectedRole} // Pass roleName explicitly
                           onDeleteAttribute={handleDeleteAttribute} // Pass handler
                           onDeleteDescription={handleDeleteDescription} // Pass handler
                           onDeleteIdeasToRole={handleDeleteIdeasToRole} // Pass handler
                           onDeleteSpecificIdea={handleDeleteSpecificIdea} // Pass handler
                        />
                         <h4>为 {selectedRole} 添加属性描述</h4>
                         <AddAttributeForm
                            roleName={selectedRole}
                            onAttributeDescriptionAdded={handleAttributeDescriptionAdded}
                            allRoles={roles}
                         />

                         <h4>从 {selectedRole} 添加想法到其他角色</h4>
                          <AddIdeaForm
                            sourceRole={selectedRole}
                            onIdeaAdded={handleIdeaAdded}
                            allRoles={roles}
                          />
                         <h4>从 {selectedRole} 为其他角色添加属性描述 (访问权默认 {selectedRole})</h4>
                          <AddAttributeForm
                            sourceRole={selectedRole}
                            onAttributeDescriptionAdded={handleDescriptionForOtherRoleAdded}
                            allRoles={roles}
                            isAddingForOtherRole={true}
                          />

                    </>
                ) : (
                    <p>请从左侧选择一个角色查看详情或进行编辑。</p>
                )}
            </div>

            <div className="parser-panel">
                <h2>图谱解析器</h2>
                 {roles.length > 0 ? (
                    <Parser roles={roles} graphData={graph} />
                 ) : (
                    <p>请先添加角色以使用解析器。</p>
                 )}
            </div>

             <div className="visualization-panel">
                 <h2>图谱可视化</h2>
                 {graph ? (
                    <GraphVisualization graphData={graph} onNodeClick={setSelectedRole} />
                 ) : (
                     <p>加载图谱数据中...</p>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;