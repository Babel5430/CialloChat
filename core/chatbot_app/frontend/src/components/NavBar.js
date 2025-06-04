// src/components/NavBar.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import './NavBar.css';

function NavBar({ visitedPages, attemptClosePage, currentPathName }) {
  const pageNames = {
    '/': '主页',
    '/chatbot': '开始聊天',
    '/memory-editor': '记忆编辑',
    '/role-graph': '角色图谱管理',
    '/standard-query': '标准查询编辑器',
    '/standard-answer': '标准回复编辑器',
    '/config': '系统配置'
  };

  return (
    <nav className="navbar">
      {visitedPages.map(pagePath => (
        <div key={pagePath} className="nav-item">
          <NavLink
            to={pagePath}
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            end={pagePath === '/'}
          >
            {pageNames[pagePath] || pagePath}
          </NavLink>
          {pagePath !== '/' && (
            <button
              className="remove-nav-item"
              onClick={() => {
                attemptClosePage(pagePath);
              }}
            >
              &#215;
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}

export default NavBar;