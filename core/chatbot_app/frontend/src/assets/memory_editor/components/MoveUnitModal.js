import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import * as api from '../api'; // Assuming api.js is in src/
import MemoryUnitPreview from './MemoryUnitPreview';

function MoveUnitModal({ isOpen, onClose, targetSessionId, onSubmit, apiError }) {
    const [availableUnits, setAvailableUnits] = useState([]);
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [selectedUnitPreview, setSelectedUnitPreview] = useState(null);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [fetchError, setFetchError] = useState('');

    useEffect(() => {
        if (isOpen && targetSessionId) {
            setLoadingUnits(true);
            setFetchError('');
            setSelectedUnitId('');
            setSelectedUnitPreview(null);
            // Fetch all Rank 0 units
            api.getMemoryUnits({ rank: 0 })
                .then(response => {
                     // Optional: Filter out units already in the target session if possible
                     // This requires fetching the target session details first, adding complexity.
                     // Let's keep it simple and show all rank 0 units. Backend handles no-op if already there.
                    setAvailableUnits(response.data || []);
                })
                .catch(error => {
                    setFetchError(api.handleApiError(error, "Failed to fetch Rank 0 units"));
                    setAvailableUnits([]);
                })
                .finally(() => setLoadingUnits(false));
        } else {
             // Clear state when closed or no target session
            setAvailableUnits([]);
            setSelectedUnitId('');
            setSelectedUnitPreview(null);
            setLoadingUnits(false);
            setFetchError('');
        }
    }, [isOpen, targetSessionId]);

     // Update preview when selection changes
    useEffect(() => {
        const unit = availableUnits.find(u => u.id === selectedUnitId);
        setSelectedUnitPreview(unit || null);
    }, [selectedUnitId, availableUnits]);

    const handleSelectChange = (e) => {
        setSelectedUnitId(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedUnitId) {
            alert("Please select a Memory Unit to move.");
            return;
        }
        onSubmit(targetSessionId, selectedUnitId);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Move Memory Unit to Session ${targetSessionId}`}>
             {apiError && <p className="error-message">{apiError}</p>}
             {fetchError && <p className="error-message">{fetchError}</p>}

            <form onSubmit={handleSubmit}>
                <label htmlFor="unitSelect">Select Memory Unit (Rank 0):</label>
                {loadingUnits ? (
                    <p>Loading units...</p>
                ) : (
                    <select id="unitSelect" value={selectedUnitId} onChange={handleSelectChange} required>
                        <option value="">-- Select a Unit --</option>
                        {availableUnits.map(unit => (
                            <option key={unit.id} value={unit.id}>
                                ID: {unit.id} (Content: {unit.content.substring(0, 50)}...)
                            </option>
                        ))}
                    </select>
                )}

                {selectedUnitPreview && (
                    <div style={{ marginTop: '15px' }}>
                        <h4>Preview:</h4>
                         <MemoryUnitPreview unit={selectedUnitPreview} />
                        {/* Or just display full content */}
                         {/* <p>{selectedUnitPreview.content}</p> */}
                    </div>
                )}

                <button type="submit" disabled={!selectedUnitId || loadingUnits}>Enqueue Move Task</button>
                <button type="button" onClick={onClose}>Cancel</button>
            </form>
        </Modal>
    );
}

export default MoveUnitModal;