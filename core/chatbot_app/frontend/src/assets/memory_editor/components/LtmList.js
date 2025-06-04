import React from 'react';

function LtmList({ ltms, onEdit, onDelete, onAddSession, loading }) {
    if (loading) return <p>Loading LTMs...</p>;
    if (!ltms || ltms.length === 0) return <p>No LTMs found.</p>;

     const parseIds = (ids) => {
        // Handle null, undefined, actual arrays, JSON array strings, or single ID strings
        if (!ids) return [];
        if (Array.isArray(ids)) return ids; // Already an array
        if (typeof ids === 'string') {
            if (ids.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(ids);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    console.warn("Could not parse LTM IDs JSON:", ids);
                    return []; 
                }
            } else {
                 return [ids]; 
            }
        }
        console.warn("Unrecognized LTM ID format:", ids);
        return []; 
    };


    return (
        <div className="ltm-list section">
            {ltms.map(ltm => {
                const sessionIds = parseIds(ltm.session_ids);
                const summaryIds = parseIds(ltm.summary_unit_ids);

                return (
                    <div key={ltm.id} className="list-item">
                        <div>
                            <strong>ID: {ltm.id}</strong> (Chatbot: {ltm.chatbot_id})<br />
                            <small>Created: {ltm.creation_time ? new Date(ltm.creation_time).toLocaleString() : 'N/A'}</small><br />
                            <small>Sessions: {sessionIds.length}</small><br/>
                            <small>Summary Units: {summaryIds.length}</small>
                        </div>
                         <div className="actions">
                            <button onClick={() => onEdit(ltm)}>Edit</button>
                            <button onClick={() => onAddSession(ltm.id)} style={{ marginLeft: '5px' }}>Add Session</button>
                            <button onClick={() => onDelete(ltm.id)} style={{ marginLeft: '5px', backgroundColor: '#c82333' }}>Delete</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default LtmList;