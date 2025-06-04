import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import * as api from '../api';
import MemoryUnitPreview from './MemoryUnitPreview'; // Re-use preview

function AddSessionToLtmModal({ isOpen, onClose, targetLtmId, onSubmit, apiError }) {
    const [availableSessions, setAvailableSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [sessionDetails, setSessionDetails] = useState(null); // To store details incl. units_preview
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [fetchError, setFetchError] = useState('');

    // Fetch available sessions when modal opens
    useEffect(() => {
        if (isOpen && targetLtmId) {
            setLoadingSessions(true);
            setFetchError('');
            setSelectedSessionId('');
            setSessionDetails(null);
            setAvailableSessions([]);

            const fetchLtmAndSessions = async () => {
                try {
                     // Fetch the target LTM to know which sessions are already linked
                     const ltmResponse = await api.getLtm(targetLtmId);
                     const ltmData = ltmResponse.data;

                     let existingSessionIds = [];
                     if (ltmData && ltmData.session_ids) {
                         if (typeof ltmData.session_ids === 'string') {
                             if (ltmData.session_ids.startsWith('[')) {
                                 existingSessionIds = JSON.parse(ltmData.session_ids);
                             } else {
                                 existingSessionIds = [ltmData.session_ids]; // Single ID case
                             }
                         } else if (Array.isArray(ltmData.session_ids)) {
                             existingSessionIds = ltmData.session_ids; // Should not happen based on backend, but good practice
                         }
                     }
                    const existingSessionIdSet = new Set(existingSessionIds);

                    // Fetch all sessions
                    const sessionsResponse = await api.getSessions();
                    // Filter out sessions already linked to the target LTM
                    const filteredSessions = (sessionsResponse.data || []).filter(
                        session => !existingSessionIdSet.has(session.id)
                    );
                    setAvailableSessions(filteredSessions);

                } catch (error) {
                    setFetchError(api.handleApiError(error, "Failed to fetch sessions or LTM details"));
                    setAvailableSessions([]);
                } finally {
                    setLoadingSessions(false);
                }
            };
            fetchLtmAndSessions();

        } else {
             // Clear state when closed
             setAvailableSessions([]);
             setSelectedSessionId('');
             setSessionDetails(null);
             setLoadingSessions(false);
             setFetchError('');
        }
    }, [isOpen, targetLtmId]);

    // Fetch details of the selected session for preview
    useEffect(() => {
        if (selectedSessionId) {
            setLoadingDetails(true);
            setSessionDetails(null); // Clear previous details
            api.getSession(selectedSessionId)
                .then(response => {
                    setSessionDetails(response.data);
                })
                .catch(error => {
                    setFetchError(api.handleApiError(error, `Failed to fetch details for session ${selectedSessionId}`));
                })
                .finally(() => setLoadingDetails(false));
        } else {
            setSessionDetails(null); // Clear details if no session selected
        }
    }, [selectedSessionId]);

    const handleSelectChange = (e) => {
        setSelectedSessionId(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedSessionId) {
            alert("Please select a Session to add.");
            return;
        }
        // Submit requires a list of session IDs, even if just one
        onSubmit(targetLtmId, [selectedSessionId]);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add Session to LTM ${targetLtmId}`}>
            {apiError && <p className="error-message">{apiError}</p>}
            {fetchError && <p className="error-message">{fetchError}</p>}

            <form onSubmit={handleSubmit}>
                <label htmlFor="sessionSelect">Select Session to Add:</label>
                {loadingSessions ? (
                    <p>Loading available sessions...</p>
                ) : availableSessions.length === 0 ? (
                     <p>No available sessions found (or all sessions are already in this LTM).</p>
                ) : (
                    <select id="sessionSelect" value={selectedSessionId} onChange={handleSelectChange} required>
                        <option value="">-- Select a Session --</option>
                        {availableSessions.map(session => (
                            <option key={session.id} value={session.id}>
                                ID: {session.id} (Created: {new Date(session.creation_time).toLocaleDateString()})
                            </option>
                        ))}
                    </select>
                )}

                {loadingDetails && <p>Loading session details...</p>}

                {sessionDetails && (
                    <div style={{ marginTop: '15px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
                        <h4>Preview of Session {selectedSessionId}:</h4>
                        <p><strong>Created:</strong> {new Date(sessionDetails.creation_time).toLocaleString()}</p>
                         <p><strong>End Time:</strong> {sessionDetails.end_time ? new Date(sessionDetails.end_time).toLocaleString() : 'N/A'}</p>
                        <h5>Memory Units in this Session:</h5>
                        {sessionDetails.units_preview && sessionDetails.units_preview.length > 0 ? (
                            sessionDetails.units_preview.map(unit => (
                                <MemoryUnitPreview key={unit.id} unit={unit} />
                            ))
                        ) : (
                            <p>No units found in this session.</p>
                        )}
                    </div>
                )}

                 <div style={{marginTop: '20px'}}>
                    <button type="submit" disabled={!selectedSessionId || loadingSessions || loadingDetails}>Enqueue Add Task</button>
                    <button type="button" onClick={onClose}>Cancel</button>
                 </div>
            </form>
        </Modal>
    );
}

export default AddSessionToLtmModal;