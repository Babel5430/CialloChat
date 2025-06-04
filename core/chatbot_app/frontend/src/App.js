// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import ConfigPage from './pages/ConfigPage';
import ChatbotPage from './pages/ChatbotPage';
import MemoryEditorPage from './pages/MemoryEditorPage';
import RoleGraphPage from './pages/RoleGraphPage';
import StandardQueryPage from './pages/StandardQueryPage';
import StandardAnswerPage from './pages/StandardAnswerPage';
import './index.css';

function App() {
  const [visitedPages, setVisitedPages] = useState(['/']);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== '/' && !visitedPages.includes(location.pathname)) {
      setVisitedPages(prevPages => [...prevPages, location.pathname]);
    }
  }, [location.pathname, visitedPages]);

  const isChatbotPage = location.pathname === '/chatbot';

  const handleModuleActionResponse = useCallback((event) => {
    const { path, success, actionType } = event.detail;
    
    // Ensure this response is for an action that implies closing the tab
    if (success && (actionType === 'close' || actionType === 'saveAndClose')) {
      setVisitedPages(prevPages => prevPages.filter(p => p !== path));
      if (path === location.pathname) {
        navigate('/'); 
      }
    } else if (!success) {
      alert(`Module at ${path} indicated an issue or cancellation for the ${actionType} action.`);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    window.addEventListener('moduleActionResponse', handleModuleActionResponse);
    return () => {
      window.removeEventListener('moduleActionResponse', handleModuleActionResponse);
    };
  }, [handleModuleActionResponse]);

  const handleAttemptClosePage = (path) => {
    let confirmMessage = "";
    let eventToDispatchName = "";

    switch (path) {
      case '/chatbot':
        confirmMessage = "This will trigger the chatbot's close and save routine. Proceed?";
        eventToDispatchName = 'triggerChatbotClose';
        break;
      case '/memory-editor':
        confirmMessage = "This will trigger the memory editor's close and save routine. Proceed?";
        eventToDispatchName = 'triggerMemoryEditorClose';
        break;
      case '/config':
        confirmMessage = "This will save the current configuration and then close this tab. Proceed?";
        eventToDispatchName = 'triggerConfigEditorSaveAndClose';
        break;
      default:
        // For non-special pages that are current, navigate home then remove tab.
        if (path === location.pathname) {
          navigate('/');
        }
        setVisitedPages(prevPages => prevPages.filter(page => page !== path));
        return;
    }

    if (window.confirm(confirmMessage)) {
      window.dispatchEvent(new CustomEvent(eventToDispatchName, { detail: { path } }));
    }
  };

  return (
    <div className={`main-app-container ${isChatbotPage ? 'chatbot-mode' : ''}`}>
      <NavBar
        visitedPages={visitedPages}
        attemptClosePage={handleAttemptClosePage}
        currentPathName={location.pathname}
      />
      <div className="app-content">
        {/* Routes... */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route path="/memory-editor" element={<MemoryEditorPage />} />
          <Route path="/role-graph" element={<RoleGraphPage />} />
          <Route path="/standard-query" element={<StandardQueryPage />} />
          <Route path="/standard-answer" element={<StandardAnswerPage />} />
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Routes>
      </div>
    </div>
  );
}

function AppWrapper() {
    return (
        <Router>
            <App />
        </Router>
    );
}

export default AppWrapper;