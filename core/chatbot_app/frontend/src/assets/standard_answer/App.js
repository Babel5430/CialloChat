import React, { useState, useEffect } from 'react';
import { fetchRoles, fetchRoleQNA, addStandardInput, updateStandardInput, deleteStandardInput, addStandardAnswer, updateStandardAnswer, deleteStandardAnswer } from './api';
import RoleSelect from './components/RoleSelect'; // Reuse RoleSelect from System 2 or create a new one
import InputManager from './components/InputManager';
import AnswerManager from './components/AnswerManager';
import './App.css'; // Create App.css for this system

function App() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [qnaData, setQnaData] = useState({}); // { "input": ["answer"], ... }
  const [selectedInput, setSelectedInput] = useState(null); // The selected input string
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingQNA, setLoadingQNA] = useState(false);
  const [error, setError] = useState(null);

  const getDisplayError = (err, contextMessage) => {
    let displayError = err.message || '未知错误';
    if (typeof displayError === 'string') {
      if (displayError.includes("status: 503") || displayError.startsWith("Cannot edit") || displayError.startsWith("Cannot access")) {
        if (displayError.startsWith("Cannot")) {
          displayError = `操作冲突: ${displayError} (请稍后再试)`;
        } else {
          displayError = `系统当前正忙或配置被锁定 (503): ${displayError}. (请稍后再试)`;
        }
      } else if (displayError.includes("Failed to fetch")) {
        displayError = `网络错误或无法连接到后端服务: ${displayError}. (请检查网络和后端状态)`;
      }
    }
    return `${contextMessage}: ${displayError}`;
  };

  // Fetch roles on initial load
  useEffect(() => {
    const loadRoles = async () => {
      setLoadingRoles(true);
      setError(null);
      try {
        const rolesData = await fetchRoles();
        setRoles(rolesData);
      } catch (err) {
        console.error("Failed to load roles:", err);
        setError(getDisplayError(err, "加载角色失败"));
        // setError(`加载角色失败: ${err.message}. 请确保角色图谱后端已运行且路径配置正确.`);
      } finally {
        setLoadingRoles(false);
      }
    };
    loadRoles();
  }, []); // Empty dependency array means run once on mount

  // Fetch Q&A data when a role is selected
  useEffect(() => {
    if (selectedRole) {
      const loadRoleQNAData = async () => {
        setLoadingQNA(true);
        setError(null); // Clear previous errors

        try {
          const qna = await fetchRoleQNA(selectedRole);
          setQnaData(qna);
          setSelectedInput(null); // Deselect input when role changes

        } catch (err) {
          console.error(`Failed to load Q&A for role ${selectedRole}:`, err);
          // setError(`加载角色 ${selectedRole} 的问答数据失败: ${err.message}`);
          setError(getDisplayError(err, `加载角色 ${selectedRole} 的问答数据失败`));
          setQnaData({}); // Clear Q&A on error
        } finally {
          setLoadingQNA(false);
        }
      };
      loadRoleQNAData();
    } else {
      // Reset states when no role is selected
      setQnaData({});
      setSelectedInput(null);
    }
  }, [selectedRole]); // Re-run when selectedRole changes

  // Function to refresh Q&A data for the current role after changes
  const refreshRoleQNA = async () => {
    if (selectedRole) {
      setLoadingQNA(true);
      setError(null);
      try {
        const qna = await fetchRoleQNA(selectedRole);
        setQnaData(qna);
      } catch (err) {
        console.error(`Failed to refresh Q&A for role ${selectedRole}:`, err);
        //  setError(`刷新角色 ${selectedRole} 的问答数据失败: ${err.message}`);
        setError(getDisplayError(err, `刷新角色 ${selectedRole} 的问答数据失败`));
        setQnaData({}); // Clear Q&A on refresh error
      } finally {
        setLoadingQNA(false);
      }
    }
  };


  // --- Handlers for Input Management ---
  const handleAddInput = async (input) => {
    try {
      await addStandardInput(selectedRole, input);
      await refreshRoleQNA(); // Refresh data after adding
      alert(`标准输入 "${input}" 已添加!`);
    } catch (err) {
      console.error("Error adding input:", err);
      const displayErrorMessage = getDisplayError(err, "添加标准输入失败");
      setError(displayErrorMessage);
      alert(displayErrorMessage);
      // setError(`添加标准输入失败: ${err.message}`);
      // alert(`添加标准输入失败: ${err.message}`);
    }
  };

  const handleUpdateInput = async (oldInput, newInput) => {
    try {
      await updateStandardInput(selectedRole, oldInput, newInput);
      await refreshRoleQNA(); // Refresh data after updating
      alert(`标准输入 "${oldInput}" 已更新为 "${newInput}"!`);
      // Update selected input if it was the one being edited
      if (selectedInput === oldInput) {
        setSelectedInput(newInput);
      }
    } catch (err) {
      console.error("Error updating input:", err);
      //  setError(`更新标准输入失败: ${err.message}`);
      //  alert(`更新标准输入失败: ${err.message}`);
      const displayErrorMessage = getDisplayError(err, "更新标准输入失败");
      setError(displayErrorMessage);
      alert(displayErrorMessage);
    }
  };

  const handleDeleteInput = async (input) => {
    if (window.confirm(`确定删除标准输入 "${input}" 及其所有回答吗？`)) {
      try {
        await deleteStandardInput(selectedRole, input);
        await refreshRoleQNA(); // Refresh data after deleting
        alert(`标准输入 "${input}" 已删除!`);
        // Deselect input if it was the one deleted
        if (selectedInput === input) {
          setSelectedInput(null);
        }
      } catch (err) {
        console.error("Error deleting input:", err);
        // setError(`删除标准输入失败: ${err.message}`);
        // alert(`删除标准输入失败: ${err.message}`);
        const displayErrorMessage = getDisplayError(err, "删除标准输入失败");
        setError(displayErrorMessage);
        alert(displayErrorMessage);
      }
    }
  };

  // --- Handlers for Answer Management ---
  const handleAddAnswer = async (input, answer) => {
    try {
      await addStandardAnswer(selectedRole, input, answer);
      await refreshRoleQNA(); // Refresh data after adding
      alert(`标准回答 "${answer}" 已添加!`);
    } catch (err) {
      console.error("Error adding answer:", err);
      // setError(`添加标准回答失败: ${err.message}`);
      // alert(`添加标准回答失败: ${err.message}`);
      const displayErrorMessage = getDisplayError(err, "添加标准回答失败");
      setError(displayErrorMessage);
      alert(displayErrorMessage);
    }
  };

  const handleUpdateAnswer = async (input, index, newAnswer) => {
    try {
      await updateStandardAnswer(selectedRole, input, index, newAnswer);
      await refreshRoleQNA(); // Refresh data after updating
      alert(`标准回答已更新!`);
      // No need to change selected input/answer state as the list refreshes
    } catch (err) {
      console.error("Error updating answer:", err);
      // setError(`更新标准回答失败: ${err.message}`);
      // alert(`更新标准回答失败: ${err.message}`);
      const displayErrorMessage = getDisplayError(err, "更新标准回答失败");
      setError(displayErrorMessage);
      alert(displayErrorMessage);
    }
  };

  const handleDeleteAnswer = async (input, index) => {
    if (window.confirm(`确定删除这条标准回答吗？`)) {
      try {
        await deleteStandardAnswer(selectedRole, input, index);
        await refreshRoleQNA(); // Refresh data after deleting
        alert(`标准回答已删除!`);
        // No need to change selected input/answer state as the list refreshes
      } catch (err) {
        console.error("Error deleting answer:", err);
        // setError(`删除标准回答失败: ${err.message}`);
        // alert(`删除标准回答失败: ${err.message}`);
        const displayErrorMessage = getDisplayError(err, "删除标准回答失败");
        setError(displayErrorMessage);
        alert(displayErrorMessage);
      }
    }
  };


  return (
    <div className="App"> {/* Using 'App' class for consistency, differentiate with App.css */}
      <header className="App-header">
        <h1>标准化回答系统</h1>
        <p>为角色图谱中的角色管理标准问答对。</p>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="container"> {/* Using 'container' class */}
        <div className="sidebar"> {/* Using 'sidebar' class */}
          <h2>选择角色</h2>
          {loadingRoles ? (
            <p>加载角色中...</p>
          ) : roles.length > 0 ? (
            <RoleSelect roles={roles} onSelectRole={setSelectedRole} selectedRole={selectedRole} />
          ) : (
            error ? <p>角色列表加载失败。</p> : <p>未找到角色。请检查配置或确保已定义角色。</p>
          )}
        </div>

        <div className="main-content"> {/* Using 'main-content' class */}
          {selectedRole ? (
            <>
              <h2>当前选中角色: {selectedRole}</h2>
              <div className="panels"> {/* Using 'panels' class */}
                <div className="input-panel">
                  {loadingQNA ? (
                    <p>加载问答数据中...</p>
                  ) : (
                    <InputManager
                      roleName={selectedRole}
                      qnaData={qnaData} // Pass all Q&A data
                      selectedInput={selectedInput}
                      onSelectInput={setSelectedInput}
                      onAddInput={handleAddInput}
                      onUpdateInput={handleUpdateInput}
                      onDeleteInput={handleDeleteInput}
                    />
                  )}
                </div>

                <div className="answer-panel">
                  {loadingQNA ? (
                    <p>加载问答数据中...</p>
                  ) : (
                    <AnswerManager
                      roleName={selectedRole}
                      selectedInput={selectedInput} // Pass selected input string
                      answers={selectedInput ? qnaData[selectedInput] || [] : []} // Pass answers for selected input
                      onAddAnswer={handleAddAnswer}
                      onUpdateAnswer={handleUpdateAnswer}
                      onDeleteAnswer={handleDeleteAnswer}
                    />
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