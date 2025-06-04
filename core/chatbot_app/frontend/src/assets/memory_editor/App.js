import React, { useState, useEffect, useCallback } from 'react';
import * as api from './api';
import TaskList from './components/TaskList';
import MemoryUnitList from './components/MemoryUnitList';
import SessionList from './components/SessionList';
import LtmList from './components/LtmList';
import MemoryUnitForm from './components/MemoryUnitForm';
import MoveUnitModal from './components/MoveUnitModal';
import AddSessionToLtmModal from './components/AddSessionToLtmModal';
import ConfirmationDialog from './components/ConfirmationDialog';
import Modal from './components/Modal';

import './App.css';

// --- Basic Stubs ---
const SessionForm = ({ isOpen, onClose, onSubmit, initialData, apiError }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Edit Session" : "Create Session"}>
        <p>Session Form - To be implemented</p>
        {apiError && <p className="error-message">Error: {apiError}</p>}
        <button onClick={() => onSubmit({})}>Enqueue (Placeholder)</button>
        <button type="button" onClick={onClose}>Cancel</button>
    </Modal>
);

const LtmForm = ({ isOpen, onClose, onSubmit, initialData, apiError }) => {
    const [chatbotId, setChatbotId] = useState('');

    useEffect(() => {
        setChatbotId(initialData?.chatbot_id || '');
    }, [initialData]);

    const handleSubmit = () => {
        onSubmit({ chatbot_id: chatbotId });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Edit LTM" : "Create LTM"}>
            {apiError && <p className="error-message">Error: {apiError}</p>}
            <div>
                <label htmlFor="ltm-chatbot-id">Chatbot ID:</label>
                <input
                    id="ltm-chatbot-id" type="text" value={chatbotId}
                    onChange={(e) => setChatbotId(e.target.value)} required
                />
            </div>
            <button onClick={handleSubmit} disabled={!chatbotId}>Enqueue</button>
            <button type="button" onClick={onClose}>Cancel</button>
        </Modal>
    );
};
// --- End Stubs ---


function App() {
    // Data state
    const [memoryUnits, setMemoryUnits] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [ltms, setLtms] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]);

    // UI State
    const [loading, setLoading] = useState({
        units: false, sessions: false, ltms: false, tasks: false, action: false
    });
    const [error, setError] = useState('');
    const [formApiError, setFormApiError] = useState('');

    // Modal State
    const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [isLtmFormOpen, setIsLtmFormOpen] = useState(false);
    const [editingLtm, setEditingLtm] = useState(null);
    const [isMoveUnitModalOpen, setIsMoveUnitModalOpen] = useState(false);
    const [targetSessionForMove, setTargetSessionForMove] = useState(null);
    const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
    const [targetLtmForAdd, setTargetLtmForAdd] = useState(null);
    const [confirmation, setConfirmation] = useState({ isOpen: false, message: '', onConfirm: null, showCheckbox: false, checkboxLabel: '' });

    // --- Data Fetching ---
    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(prev => ({ ...prev, units: true, sessions: true, ltms: true, tasks: true }));
        setError('');
        try {
            const [unitsRes, sessionsRes, ltmsRes, tasksRes] = await Promise.all([
                api.getMemoryUnits(),
                api.getSessions(),
                api.getLtms(),
                api.getTasks()
            ]);
            setMemoryUnits(unitsRes.data || []);
            setSessions(sessionsRes.data || []);
            setLtms(ltmsRes.data || []);
            setPendingTasks(tasksRes.data || []);
        } catch (err) {
            setError(api.handleApiError(err, 'Failed to fetch initial data'));
        } finally {
            if (showLoading) setLoading(prev => ({ ...prev, units: false, sessions: false, ltms: false, tasks: false }));
        }
    }, []);

    const fetchTasks = useCallback(async () => {
        setLoading(prev => ({ ...prev, tasks: true }));
        try {
            const tasksRes = await api.getTasks();
            setPendingTasks(tasksRes.data || []);
        } catch (err) {
            setError(api.handleApiError(err, 'Failed to fetch tasks'));
        } finally {
            setLoading(prev => ({ ...prev, tasks: false }));
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Task Handling ---
    const handleConfirmTask = async (taskId) => {
        setLoading(prev => ({ ...prev, action: true }));
        setError('');
        try {
            await api.confirmTask(taskId);
            await fetchData(false); // Refresh ALL data
        } catch (err) {
            setError(api.handleApiError(err, `Failed to confirm task ${taskId}`));
            await fetchTasks();
        } finally {
            setLoading(prev => ({ ...prev, action: false }));
        }
    };
    const handleCancelTask = async (taskId) => {
        setLoading(prev => ({ ...prev, action: true }));
        setError('');
        try {
            await api.cancelTask(taskId);
            await fetchTasks();
        } catch (err) {
            setError(api.handleApiError(err, `Failed to cancel task ${taskId}`));
            await fetchTasks();
        } finally {
            setLoading(prev => ({ ...prev, action: false }));
        }
    };

    const handleBatchConfirm = async (taskIds) => {
        setLoading(prev => ({ ...prev, action: true }));
        setError('');
        try {
            const results = await api.confirmMultipleTasks(taskIds);
            const failed = results.filter(r => r.status === 'error');
            if (failed.length > 0) {
                setError(`Failed to confirm ${failed.length} tasks. See console for details.`);
                console.error("Batch confirm failures:", failed);
            }
            await fetchData(false); // Refresh all data
        } catch (err) {
            setError(api.handleApiError(err, `Failed during batch confirmation`));
            await fetchTasks();
        } finally {
            setLoading(prev => ({ ...prev, action: false }));
        }
    };

    const handleBatchCancel = async (taskIds) => {
        setLoading(prev => ({ ...prev, action: true }));
        setError('');
        try {
            const results = await api.cancelMultipleTasks(taskIds);
            const failed = results.filter(r => r.status === 'error');
            if (failed.length > 0) {
                setError(`Failed to cancel ${failed.length} tasks. See console for details.`);
                console.error("Batch cancel failures:", failed);
            }
            await fetchTasks(); // Only refresh tasks
        } catch (err) {
            setError(api.handleApiError(err, `Failed during batch cancellation`));
            await fetchTasks();
        } finally {
            setLoading(prev => ({ ...prev, action: false }));
        }
    };


    // --- Generic Action Enqueuer ---
    const enqueueAction = async (actionFn, successMessage, errorMessage) => {
        setLoading(prev => ({ ...prev, action: true }));
        setFormApiError('');
        setError('');
        try {
            const response = await actionFn();
            console.log(successMessage, response.data);
            await fetchTasks();
            return true;
        } catch (err) {
            const errMsg = api.handleApiError(err, errorMessage);
            setError(errMsg);
            setFormApiError(errMsg);
            await fetchTasks();
            return false;
        } finally {
            setLoading(prev => ({ ...prev, action: false }));
        }
    };


    // --- Memory Unit Actions ---
    const handleOpenUnitForm = (unit = null) => {
        setEditingUnit(unit);
        setFormApiError('');
        setIsUnitFormOpen(true);
    };

    const handleUnitFormSubmit = async (data) => {
        let success;
        if (editingUnit?.id) {
            success = await enqueueAction(
                () => api.enqueueUpdateMemoryUnit(editingUnit.id, data),
                'Update unit task enqueued:', 'Failed to enqueue unit update'
            );
        } else {
            success = await enqueueAction(
                () => api.enqueueCreateMemoryUnit(data),
                'Create unit task enqueued:', 'Failed to enqueue unit creation'
            );
        }
        if (success) {
            setIsUnitFormOpen(false);
            setEditingUnit(null);
        }
    };

    const handleDeleteUnit = (unitId) => {
        setConfirmation({
            isOpen: true,
            message: `Are you sure you want to delete Memory Unit ${unitId}? This will only enqueue the deletion.`,
            onConfirm: async () => {
                setConfirmation({ isOpen: false });
                await enqueueAction(
                    () => api.enqueueDeleteMemoryUnit(unitId),
                    `Delete unit task ${unitId} enqueued:`,
                    `Failed to enqueue unit ${unitId} deletion`
                );
            }
        });
    };


    // --- Session Actions ---
    const handleOpenSessionForm = (session = null) => {
        setEditingSession(session);
        setFormApiError('');
        setIsSessionFormOpen(true);
    };

    const handleSessionFormSubmit = async (data) => {
        let success;
        if (editingSession?.id) {
            success = await enqueueAction(
                () => api.enqueueUpdateSession(editingSession.id, data),
                'Update session task enqueued:', 'Failed to enqueue session update'
            );
        } else {
            success = await enqueueAction(
                () => api.enqueueCreateSession(data),
                'Create session task enqueued:', 'Failed to enqueue session creation'
            );
        }
        if (success) {
            setIsSessionFormOpen(false);
            setEditingSession(null);
        }
    };

    const handleDeleteSession = (sessionId) => {
        setConfirmation({
            isOpen: true,
            title: `Delete Session ${sessionId}?`,
            message: `Are you sure you want to delete Session ${sessionId}?\nCheck the box below to ALSO delete all associated Rank 0 Memory Units.`,
            showCheckbox: true,
            checkboxLabel: "Delete associated Rank 0 units (as per rules)",
            onConfirm: async (deleteUnitsFlag) => {
                setConfirmation({ isOpen: false });
                await enqueueAction(
                    () => api.enqueueDeleteSession(sessionId, deleteUnitsFlag),
                    `Delete session task ${sessionId} enqueued (Delete Units: ${deleteUnitsFlag}):`,
                    `Failed to enqueue session ${sessionId} deletion`
                );
            }
        });
    };

    const handleOpenMoveUnitModal = (sessionId) => {
        setTargetSessionForMove(sessionId);
        setFormApiError('');
        setIsMoveUnitModalOpen(true);
    };
    const handleMoveUnitSubmit = async (sessionId, unitId) => {
        const success = await enqueueAction(
            () => api.enqueueMoveUnitToSession(sessionId, unitId),
            `Move unit ${unitId} to session ${sessionId} task enqueued:`,
            `Failed to enqueue unit move`
        );
        if (success) {
            setIsMoveUnitModalOpen(false);
            setTargetSessionForMove(null);
        }
    };


    // --- LTM Actions ---
    const handleOpenLtmForm = (ltm = null) => {
        setEditingLtm(ltm);
        setFormApiError('');
        setIsLtmFormOpen(true);
    };

    const handleLtmFormSubmit = async (data) => {
        let success;
        if (editingLtm?.id) {
            success = await enqueueAction(
                () => api.enqueueUpdateLtm(editingLtm.id, data),
                'Update LTM task enqueued:', 'Failed to enqueue LTM update'
            );
        } else {
            success = await enqueueAction(
                () => api.enqueueCreateLtm(data),
                'Create LTM task enqueued:', 'Failed to enqueue LTM creation'
            );
        }
        if (success) {
            setIsLtmFormOpen(false);
            setEditingLtm(null);
        }
    };

    const handleDeleteLtm = (ltmId) => {
        setConfirmation({
            isOpen: true,
            message: `Are you sure you want to delete LTM ${ltmId}?\nThis will also delete its associated summary units but NOT the sessions.`,
            onConfirm: async () => {
                setConfirmation({ isOpen: false });
                await enqueueAction(
                    () => api.enqueueDeleteLtm(ltmId),
                    `Delete LTM task ${ltmId} enqueued:`,
                    `Failed to enqueue LTM ${ltmId} deletion`
                );
            }
        });
    };

    const handleOpenAddSessionModal = (ltmId) => {
        setTargetLtmForAdd(ltmId);
        setFormApiError('');
        setIsAddSessionModalOpen(true);
    };
    const handleAddSessionSubmit = async (ltmId, sessionIds) => {
        const success = await enqueueAction(
            () => api.enqueueAddSessionsToLtm(ltmId, sessionIds),
            `Add session(s) to LTM ${ltmId} task enqueued:`,
            `Failed to enqueue adding session(s) to LTM`
        );
        if (success) {
            setIsAddSessionModalOpen(false);
            setTargetLtmForAdd(null);
        }
    };

    // --- System Actions ---
    const handleCloseSystem = (isTriggeredByEvent = false) => { // Add flag
        const proceedClose = () => {
            setLoading(prev => ({ ...prev, action: true }));
            setError('');
            let success = false;
            api.closeSystem()
                .then(response => {
                    let alertMessage;
                    if (response.data.message) {
                        alertMessage = response.data.message;
                        if (response.data.status && response.data.status !== response.data.message && !response.data.message.includes(response.data.status)) {
                            alertMessage += ` (System status: ${response.data.status})`;
                        }
                    } else if (response.data.status) {
                        alertMessage = response.data.status;
                    } else {
                        alertMessage = "Request to close system processed, but no specific status message received.";
                    }
                    alert(alertMessage); // Keep original user feedback
                    success = true;
                })
                .catch(err => {
                    setError(api.handleApiError(err, 'Failed to close system')); // Keep original user feedback
                    success = false;
                })
                .finally(() => {
                    setLoading(prev => ({ ...prev, action: false }));
                    window.dispatchEvent(new CustomEvent('moduleActionResponse', { detail: { path: '/memory-editor', success, actionType: 'close' } }));
                });
        };

        if (isTriggeredByEvent) { 
            proceedClose();
        } else {
            setConfirmation({
                isOpen: true,
                title: "Close Memory System?",
                message: "Are you sure you want to close the memory system?\nThis will attempt to flush any pending changes and close connections.\nThis action is NOT enqueued and happens immediately.",
                onConfirm: async () => {
                    setConfirmation({ isOpen: false });
                    proceedClose();
                },
                onCancel: () => { 
                    setConfirmation({ isOpen: false });
                    if (!isTriggeredByEvent) { 
                        window.dispatchEvent(new CustomEvent('moduleActionResponse', { detail: { path: '/memory-editor', success: false, actionType: 'close' } }));
                    }
                }
            });
        }
    };

    useEffect(() => {
        const closeRequestHandler = (event) => {
            if (event.detail && event.detail.path === '/memory-editor') {
                handleCloseSystem(true);
            }
        };
        window.addEventListener('triggerMemoryEditorClose', closeRequestHandler);
        return () => {
            window.removeEventListener('triggerMemoryEditorClose', closeRequestHandler);
        };
    }, [handleCloseSystem]);

    return (
        <div className="App">
            <div className="main-header">
                <h1>Chatbot Memory Manager</h1>
                <button
                    onClick={handleCloseSystem}
                    className="close-system-btn"
                    disabled={loading.action}
                    title="Flush changes and close the memory system"
                >
                    ⚠️ Close System
                </button>
            </div>


            {error && <p className="error-message global-error">{error} <button onClick={() => setError('')}>X</button></p>}
            {loading.action && <p className="loading-indicator">Processing Action...</p>}


            {/* Task List */}
            <TaskList
                tasks={pendingTasks}
                onConfirm={handleConfirmTask}
                onCancel={handleCancelTask}
                onBatchConfirm={handleBatchConfirm}
                onBatchCancel={handleBatchCancel}
                loading={loading.tasks || loading.action}
            />

            <hr />

            {/* Memory Unit Section */}
            <div className="section">
                <div className="section-header">
                    <h2>Memory Units</h2>
                    <button onClick={() => handleOpenUnitForm()}>+ Add Memory Unit</button>
                </div>
                <MemoryUnitList
                    units={memoryUnits}
                    onEdit={handleOpenUnitForm}
                    onDelete={handleDeleteUnit}
                    loading={loading.units}
                />
            </div>

            <hr />

            {/* Session Section */}
            <div className="section">
                <div className="section-header">
                    <h2>Session Memories</h2>
                    <button onClick={() => handleOpenSessionForm()}>+ Add Session</button>
                </div>
                <SessionList
                    sessions={sessions}
                    onEdit={handleOpenSessionForm}
                    onDelete={handleDeleteSession}
                    onMoveUnit={handleOpenMoveUnitModal}
                    loading={loading.sessions}
                />
            </div>

            <hr />

            {/* LTM Section */}
            <div className="section">
                <div className="section-header">
                    <h2>Long Term Memories (LTM)</h2>
                    <button onClick={() => handleOpenLtmForm()}>+ Add LTM</button>
                </div>
                <LtmList
                    ltms={ltms}
                    onEdit={handleOpenLtmForm}
                    onDelete={handleDeleteLtm}
                    onAddSession={handleOpenAddSessionModal}
                    loading={loading.ltms}
                />
            </div>


            {/* Modals */}
            <MemoryUnitForm
                isOpen={isUnitFormOpen}
                onClose={() => setIsUnitFormOpen(false)}
                onSubmit={handleUnitFormSubmit}
                initialData={editingUnit}
                apiError={formApiError}
            />
            <SessionForm
                isOpen={isSessionFormOpen}
                onClose={() => setIsSessionFormOpen(false)}
                onSubmit={handleSessionFormSubmit}
                initialData={editingSession}
                apiError={formApiError}
            />
            <LtmForm
                isOpen={isLtmFormOpen}
                onClose={() => setIsLtmFormOpen(false)}
                onSubmit={handleLtmFormSubmit}
                initialData={editingLtm}
                apiError={formApiError}
            />

            <MoveUnitModal
                isOpen={isMoveUnitModalOpen}
                onClose={() => setIsMoveUnitModalOpen(false)}
                targetSessionId={targetSessionForMove}
                onSubmit={handleMoveUnitSubmit}
                apiError={formApiError}
            />

            <AddSessionToLtmModal
                isOpen={isAddSessionModalOpen}
                onClose={() => setIsAddSessionModalOpen(false)}
                targetLtmId={targetLtmForAdd}
                onSubmit={handleAddSessionSubmit}
                apiError={formApiError}
            />

            <ConfirmationDialog
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation({ isOpen: false })}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
                showCheckbox={confirmation.showCheckbox}
                checkboxLabel={confirmation.checkboxLabel}
            />

        </div>
    );
}

export default App;