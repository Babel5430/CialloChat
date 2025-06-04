import React from 'react';

function MemoryUnitPreview({ unit }) {
    if (!unit) return null;
    const maxLength = 100; // Max length for preview
    const contentPreview = unit.content.length > maxLength
        ? unit.content.substring(0, maxLength) + '...'
        : unit.content;

    return (
        <div style={{ border: '1px solid #eee', padding: '5px', margin: '5px 0', fontSize: '0.9em' }}>
            <small>ID: {unit.id} | Rank: {unit.rank}</small><br/>
            <p style={{ margin: '2px 0' }}>{contentPreview}</p>
            <small>Created: {unit.creation_time ? new Date(unit.creation_time).toLocaleString() : 'N/A'}</small>
        </div>
    );
}

export default MemoryUnitPreview;