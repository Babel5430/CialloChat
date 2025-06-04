import React from 'react';
import { Link } from 'react-router-dom';
import './App.css';

function HomePage() {
  return (
    <div className="home-page">
      <h1>Chatbot</h1>
      <p>选择一个功能:</p>
      <div className="component-links">
        <Link to="/chatbot" className="component-link">开始聊天</Link>
        <Link to="/memory-editor" className="component-link">记忆编辑</Link>
        <Link to="/role-graph" className="component-link">角色图谱管理</Link>
        <Link to="/standard-query" className="component-link">标准查询编辑器</Link>
        <Link to="/standard-answer" className="component-link">标准回复编辑器</Link>
        <Link to="/config" className="component-link">系统配置</Link>
      </div>
    </div>
  );
}

export default HomePage;