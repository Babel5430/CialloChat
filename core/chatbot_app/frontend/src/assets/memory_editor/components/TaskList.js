import React, { useState, useEffect } from 'react';

function TaskList({ tasks, onConfirm, onCancel, onBatchConfirm, onBatchCancel, loading }) {
    const [selectedTasks, setSelectedTasks] = useState(new Set());

    useEffect(() => {
        setSelectedTasks(new Set());
    }, [tasks]);

    const handleSelectChange = (taskId, isChecked) => {
        setSelectedTasks(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (isChecked) {
                newSelected.add(taskId);
            } else {
                newSelected.delete(taskId);
            }
            return newSelected;
        });
    };
    const handleSelectAll = (isChecked) => {
        if (isChecked) {
            setSelectedTasks(new Set(tasks.map(t => t.task_id)));
        } else {
            setSelectedTasks(new Set());
        }
    };
    const handleBatchConfirmClick = () => {
        if (selectedTasks.size > 0) {
            onBatchConfirm(Array.from(selectedTasks));
        } else {
            alert("Please select tasks to confirm.");
        }
    };
    const handleBatchCancelClick = () => {
         if (selectedTasks.size > 0) {
            onBatchCancel(Array.from(selectedTasks));
        } else {
            alert("Please select tasks to cancel.");
        }
    };


    if (!tasks || tasks.length === 0) {
        return <p>No pending tasks requiring confirmation.</p>;
    }

    const allSelected = tasks.length > 0 && selectedTasks.size === tasks.length;


    return (
        <div className="task-list section">
            <h3>Pending Confirmation Tasks</h3>
            {loading && <p>Loading tasks...</p>}
            <div className="task-batch-actions">
                 <button onClick={handleBatchConfirmClick} disabled={loading || selectedTasks.size === 0}>
                    Confirm Selected ({selectedTasks.size})
                </button>
                 <button onClick={handleBatchCancelClick} disabled={loading || selectedTasks.size === 0} style={{ backgroundColor: '#dc3545' }}>
                    Cancel Selected ({selectedTasks.size})
                </button>
            </div>
            <ul>
                <li>
                     <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={loading}
                        title="Select/Deselect All"
                    />
                    <strong>Select All</strong>
                </li>
                {tasks.map(task => (
                    <li key={task.task_id}>
                         <input
                            type="checkbox"
                            checked={selectedTasks.has(task.task_id)}
                            onChange={(e) => handleSelectChange(task.task_id, e.target.checked)}
                            disabled={loading}
                        />
                        <span>{task.description || 'No description'} (ID: {task.task_id})</span>
                        <div>
                             <button onClick={() => onConfirm(task.task_id)} disabled={loading}>Confirm</button>
                             <button onClick={() => onCancel(task.task_id)} disabled={loading} style={{ marginLeft: '5px' }}>Cancel</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default TaskList;