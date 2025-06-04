import React from 'react';
import MemoryUnitPreview from './MemoryUnitPreview';

function MemoryUnitList({ units, onEdit, onDelete, loading }) {
    if (loading) return <p>Loading memory units...</p>;
    if (!units || units.length === 0) return <p>No memory units found.</p>;

    return (
        <div className="memory-unit-list section">
            <h3>Memory Units</h3>
            {/* Add filtering controls here if needed */}
            {units.map(unit => (
                <div key={unit.id} className="list-item">
                    <MemoryUnitPreview unit={unit} />
                    <div className="actions">
                        <button onClick={() => onEdit(unit)}>Edit</button>
                        <button onClick={() => onDelete(unit.id)} style={{ marginLeft: '5px' }}>Delete</button>
                        {/* Add more actions like 'View Details' if needed */}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default MemoryUnitList;