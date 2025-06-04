import React, { useState, useEffect, useCallback } from 'react';
import { getConfig, updateConfig } from './api'
import './App.css';

function ConfigPage() {
    const [configData, setConfigData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');
    const [expandedSections, setExpandedSections] = useState({});

    const loadConfigData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSaveStatus('');
        try {
            const response = await getConfig();
            setConfigData(response.data);
            setExpandedSections({});
            console.log("loadConfigData: Config loaded successfully.");
        } catch (err) {
            setError('Failed to load configuration.');
            console.error("loadConfigData: Error loading config", err);
        } finally {
            setIsLoading(false);
            console.log("loadConfigData: Finished loading attempt.");
        }
    }, []);

    useEffect(() => {
        loadConfigData();
    }, [loadConfigData]);

    const handleInputChange = (event, path) => {
        const { value, type } = event.target;
        setConfigData(prevConfig => {
            const keys = path.split('.');
            const newConfig = JSON.parse(JSON.stringify(prevConfig)); // Deep copy
            let current = newConfig;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
                if (current === undefined) return prevConfig;
            }
            const lastKey = keys[keys.length - 1];
            // Handle type conversions
            if (path === 'PORT' || path.endsWith('.PORT')) {
                current[lastKey] = value === '' ? null : parseInt(value, 10);
            } else if (type === 'checkbox' || path === 'DEBUG' || path.endsWith('.DEBUG')) {
                current[lastKey] = event.target.checked; // Use 'checked' for boolean/checkbox
            } else if (value === 'true' || value === 'false') {
                current[lastKey] = value === 'true'; // Handle select-based booleans
            } else {
                current[lastKey] = value;
            }
            return newConfig;
        });
    };

    const handleSaveConfig = async (isTriggeredByEvent = false) => { // Add flag
        console.log("handleSaveConfig: Save process started.");
        setIsLoading(true);
        setError(null);
        setSaveStatus('Saving...');
        let success = false;
        try {
            console.log("handleSaveConfig: Attempting to call updateConfig API...");
            const response = await updateConfig(configData);
            console.log("handleSaveConfig: updateConfig API call successful. Response:", response);
            setSaveStatus('Configuration saved successfully! Restart may be required.');
            if (!isTriggeredByEvent) alert('Configuration saved successfully! Restart may be required.');

            success = true;
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message || 'Failed to save configuration.';
            setError(errMsg);
            setSaveStatus('');
            console.error("handleSaveConfig: Error saving configuration.", { /* ... */ });
            if (!isTriggeredByEvent) alert(`Failed to save configuration: ${errMsg}`);
            success = false;
        } finally {
            setIsLoading(false);
            console.log("handleSaveConfig: isLoading set to false in finally block.");
            window.dispatchEvent(new CustomEvent('moduleActionResponse', { detail: { path: '/config', success, actionType: 'saveAndClose' } }));
        }
    };

    useEffect(() => {
        const saveAndCloseRequestHandler = (event) => {
            if (event.detail && event.detail.path === '/config') {
                handleSaveConfig(true); // Pass true to indicate it's triggered by event
            }
        };
        window.addEventListener('triggerConfigEditorSaveAndClose', saveAndCloseRequestHandler);
        return () => {
            window.removeEventListener('triggerConfigEditorSaveAndClose', saveAndCloseRequestHandler);
        };
    }, [configData, handleSaveConfig]);

    const toggleSection = (path) => {
        setExpandedSections(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    const renderConfigFields = (data, parentPath = '') => {
        return Object.entries(data).map(([key, value]) => {
            const currentPath = parentPath ? `${parentPath}.${key}` : key;
            const isExpanded = !!expandedSections[currentPath]; 

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return (
                    <fieldset key={currentPath} className="config-group">
                        <legend onClick={() => toggleSection(currentPath)} style={{ cursor: 'pointer' }}>
                            {isExpanded ? '▼' : '►'} {key}
                        </legend>
                        {isExpanded && (
                            <div className="config-group-content">
                                {renderConfigFields(value, currentPath)}
                            </div>
                        )}
                    </fieldset>
                );
            } else if (typeof value === 'boolean') {
                return (
                    <div key={currentPath} className="config-field">
                        <label htmlFor={currentPath}>{key}:</label>
                        <select
                            id={currentPath}
                            value={String(value)}
                            onChange={(e) => handleInputChange(e, currentPath)}
                        >
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    </div>
                );
            } else {
                const inputType = (typeof value === 'number') ? 'number' : 'text';
                return (
                    <div key={currentPath} className="config-field">
                        <label htmlFor={currentPath}>{key}:</label>
                        <input
                            type={inputType}
                            id={currentPath}
                            value={value === null ? '' : value}
                            onChange={(e) => handleInputChange(e, currentPath)}
                        />
                    </div>
                );
            }
        });
    };

    return (
        <div className="config-page">
            <h2>系统设置</h2>
            {isLoading && <p>加载配置中...</p>}
            {error && <p className="error">错误: {error}</p>}
            {configData && (
                <form onSubmit={(e) => e.preventDefault()}>
                    {renderConfigFields(configData)}
                    <button type="button" onClick={handleSaveConfig} disabled={isLoading}>
                        保存配置
                    </button>
                    {saveStatus && <p className="save-status">{saveStatus}</p>}
                </form>
            )}
        </div>
    );
}

export default ConfigPage;