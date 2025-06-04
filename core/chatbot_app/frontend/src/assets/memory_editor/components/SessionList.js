import React from 'react';

function SessionList({ sessions, onEdit, onDelete, onMoveUnit, onAddSessionToLtm, loading }) {
    if (loading) return <p>Loading sessions...</p>;
    if (!sessions || sessions.length === 0) return <p>No sessions found.</p>;

    const parseIds = (ids) => {
        if (!ids) return 0;
        if (typeof ids === 'string') {
            try {
                const parsed = JSON.parse(ids);
                return Array.isArray(parsed) ? parsed.length : 0;
            } catch (e) {
                 // console.warn("Could not parse IDs:", ids); // Might be noisy if single IDs are common
                 return 0; // Or 1 if single IDs are expected as strings
            }
        }
        return Array.isArray(ids) ? ids.length : 0; // Should ideally be handled by backend/api layer
    };


    return (
        <div className="session-list section">
            <h3>Sessions</h3>
            {sessions.map(session => (
                <div key={session.id} className="list-item">
                    <div>
                        <strong>ID: {session.id}</strong><br />
                        <small>Created: {session.creation_time ? new Date(session.creation_time).toLocaleString() : 'N/A'}</small><br />
                        <small>Units: {parseIds(session.memory_unit_ids)}</small>
                    </div>
                    <div className="actions">
                        <button onClick={() => onEdit(session)}>Edit</button>
                        <button onClick={() => onMoveUnit(session.id)} style={{ marginLeft: '5px' }}>Move Unit Here</button>
                        {/* onDelete requires confirmation about deleting units */}
                        <button onClick={() => onDelete(session.id)} style={{ marginLeft: '5px' }}>Delete</button>
                         {/* Add button for LTM if needed */}
                        {/* <button onClick={() => onAddSessionToLtm(session.id)} style={{marginLeft: '5px'}}>Add to LTM</button> */}

                    </div>
                </div>
            ))}
        </div>
    );
}

export default SessionList;