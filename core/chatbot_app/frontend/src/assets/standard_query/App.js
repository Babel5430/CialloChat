import React, { useState, useEffect } from 'react';
import { fetchRoles, fetchRoleConcepts, fetchRoleQueries, addOrUpdateQuery, deleteQuery } from './api';
import RoleSelect from './components/RoleSelect'; // Create this component or reuse RoleList structure
import ConceptList from './components/ConceptList';
import QueryManager from './components/QueryManager';
import './App.css'; // Create App.css

function App() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [roleQueries, setRoleQueries] = useState({}); // {"concept": ["q1", ...]}
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [error, setError] = useState(null);

  // Fetch roles on initial load
  useEffect(() => {
    const loadRoles = async () => {
      setLoadingRoles(true);
      setError(null);
      try {
        const rolesData = await fetchRoles();
        setRoles(rolesData);
      } catch (err) {
        // console.error("Failed to load roles:", err);
        setError(`加载角色失败: ${err.message}. 请确保角色图谱后端已运行且路径配置正确.`);
      } finally {
        setLoadingRoles(false);
      }
    };
    loadRoles();
  }, []); // Empty dependency array means run once on mount

  // Fetch concepts and queries when a role is selected
  useEffect(() => {
    if (selectedRole) {
      const loadConceptsAndQueries = async () => {
        setLoadingConcepts(true);
        setLoadingQueries(true);
        setError(null); // Clear previous errors

        try {
          const conceptsData = await fetchRoleConcepts(selectedRole);
          setConcepts(conceptsData);
          setSelectedConcept(null); // Deselect concept when role changes

          const queriesData = await fetchRoleQueries(selectedRole);
          setRoleQueries(queriesData);

        } catch (err) {
          console.error(`Failed to load data for role ${selectedRole}:`, err);
          setError(`加载角色 ${selectedRole} 的数据失败: ${err.message}`);
          setConcepts([]);
          setRoleQueries({});
        } finally {
          setLoadingConcepts(false);
          setLoadingQueries(false);
        }
      };
      loadConceptsAndQueries();
    } else {
      // Reset states when no role is selected
      setConcepts([]);
      setSelectedConcept(null);
      setRoleQueries({});
    }
  }, [selectedRole]); // Re-run when selectedRole changes

  // Function to refresh queries for the current role after changes
  const refreshRoleQueries = async () => {
     if (selectedRole) {
         setLoadingQueries(true);
         setError(null);
         try {
             const queriesData = await fetchRoleQueries(selectedRole);
             setRoleQueries(queriesData);
         } catch (err) {
             console.error(`Failed to refresh queries for role ${selectedRole}:`, err);
             setError(`刷新角色 ${selectedRole} 的查询语句失败: ${err.message}`);
             setRoleQueries({}); // Clear queries on refresh error
         } finally {
             setLoadingQueries(false);
         }
     }
  };


  const handleAddOrUpdateQuery = async (concept, query, index = null) => {
    try {
      await addOrUpdateQuery(selectedRole, concept, query, index);
      await refreshRoleQueries(); // Refresh queries after successful operation
      alert(`查询语句已${index === null ? '添加' : '更新'}!`);
    } catch (err) {
      console.error(`Error adding/updating query:`, err);
      setError(`操作失败: ${err.message}`);
      alert(`操作失败: ${err.message}`);
    }
  };

   const handleDeleteQuery = async (concept, index) => {
       if (window.confirm(`确定删除这条查询语句吗?`)) {
           try {
               await deleteQuery(selectedRole, concept, index);
               await refreshRoleQueries(); // Refresh queries after successful deletion
               alert(`查询语句已删除!`);
               setSelectedConcept(null); // Deselect concept to refresh views cleanly
               // Re-select after a brief delay to show updated list
               setTimeout(() => setSelectedConcept(concept), 50);

           } catch (err) {
               console.error(`Error deleting query:`, err);
               setError(`删除失败: ${err.message}`);
               alert(`删除失败: ${err.message}`);
           }
       }
   };


  return (
    <div className="App">
      <header className="App-header">
        <h1>角色属性标准查询语句管理系统</h1>
        <p>读取角色图谱数据生成可查询项，为每个角色的可查询项维护自然语言查询语句。</p>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="container">
        <div className="sidebar">
            <h2>选择角色</h2>
            {loadingRoles ? (
                <p>加载角色中...</p>
            ) : roles.length > 0 ? (
                 <RoleSelect roles={roles} onSelectRole={setSelectedRole} selectedRole={selectedRole} />
            ) : (
                <p>未找到角色。请检查角色图谱文件路径。</p>
            )}
        </div>

        <div className="main-content">
            {selectedRole ? (
                <>
                     <h2>当前选中角色: {selectedRole}</h2>
                     <div className="panels">
                        <div className="concept-panel">
                             <h3>可查询项列表</h3>
                             {loadingConcepts ? (
                                 <p>加载可查询项中...</p>
                             ) : concepts.length > 0 ? (
                                 <ConceptList concepts={concepts} onSelectConcept={setSelectedConcept} selectedConcept={selectedConcept} />
                             ) : (
                                 <p>该角色没有可查询项 (无属性或想法，或图谱文件错误)。</p>
                             )}
                        </div>

                        <div className="query-panel">
                             <h3>查询语句管理</h3>
                             {selectedConcept ? (
                                 loadingQueries ? (
                                     <p>加载查询语句中...</p>
                                 ) : (
                                     <QueryManager
                                        roleName={selectedRole}
                                        concept={selectedConcept}
                                        queries={roleQueries[selectedConcept] || []} // Pass queries for the selected concept
                                        onAddOrUpdateQuery={handleAddOrUpdateQuery}
                                        onDeleteQuery={handleDeleteQuery}
                                     />
                                 )
                             ) : (
                                 <p>请从左侧列表选择一个可查询项。</p>
                             )}
                        </div>
                     </div>
                </>
            ) : (
                 <p>请从左侧选择一个角色。</p>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;