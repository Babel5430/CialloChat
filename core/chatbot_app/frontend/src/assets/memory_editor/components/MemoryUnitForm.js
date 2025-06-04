import React, { useState, useEffect } from 'react';
import Modal from './Modal';

function MemoryUnitForm({ isOpen, onClose, onSubmit, initialData, apiError }) {
    const [formData, setFormData] = useState({});
    const isEditMode = Boolean(initialData && initialData.id);

    useEffect(() => {
        if (isOpen) {
             const defaultData = {
                content: '',
                parent_id: null,
                source: 'ai', 
                metadata: '{}',
                children_ids: '[]',
                rank: 0,
                pre_id: null,
                next_id: null,
                group_id: null,
                never_delete: 0,
                end_time: null,
                visit_count: 0,
                last_visit: 0,
            };
            const parsedInitial = initialData ? {
                ...initialData,
                metadata: typeof initialData.metadata === 'object' ? JSON.stringify(initialData.metadata, null, 2) : initialData.metadata || '{}',
                children_ids: typeof initialData.children_ids === 'object' ? JSON.stringify(initialData.children_ids) : initialData.children_ids || '[]',
                 group_id: initialData.rank === 1 && Array.isArray(initialData.group_id)
                    ? JSON.stringify(initialData.group_id)
                    : initialData.group_id,
            } : {};

            setFormData({ ...defaultData, ...parsedInitial });
        }
    }, [isOpen, initialData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
    };

    const handleJsonChange = (e) => {
         const { name, value } = e.target;
         setFormData(prev => ({
             ...prev,
             [name]: value
         }));
     };


    const handleSubmit = (e) => {
        e.preventDefault();
        let metadataObj, childrenIdsArr, groupIdVal;

        try {
            metadataObj = JSON.parse(formData.metadata || '{}');
        } catch (err) {
            alert("Invalid JSON format for Metadata.");
            return;
        }
         try {
            childrenIdsArr = JSON.parse(formData.children_ids || '[]');
            if (!Array.isArray(childrenIdsArr)) throw new Error("Not an array");
        } catch (err) {
            alert("Invalid JSON Array format for Children IDs.");
            return;
        }

        groupIdVal = formData.group_id;
        if (parseInt(formData.rank, 10) === 1 && typeof groupIdVal === 'string' && groupIdVal.trim().startsWith('[')) {
            try {
                groupIdVal = JSON.parse(groupIdVal);
                 if (!Array.isArray(groupIdVal)) throw new Error("Not an array");
            } catch (err) {
                 alert("Invalid JSON Array format for Group ID (Rank 1 requires a list or single ID).");
                 return;
            }
        }


        const dataToSend = {
             ...formData,
             metadata: metadataObj,
             children_ids: childrenIdsArr,
             rank: parseInt(formData.rank, 10),
             never_delete: parseInt(formData.never_delete, 10),
             visit_count: parseInt(formData.visit_count, 10),
             last_visit: parseInt(formData.last_visit, 10),
             group_id: groupIdVal, 
         };

         Object.keys(dataToSend).forEach(key => {
            if (dataToSend[key] === '') {
                dataToSend[key] = null;
            }
         });


        onSubmit(dataToSend);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Memory Unit" : "Create Memory Unit"}>
            <form onSubmit={handleSubmit} className="memory-unit-form">
                {apiError && <p className="error-message">{apiError}</p>}

                <label>Content *</label>
                <textarea name="content" value={formData.content || ''} onChange={handleChange} required rows="5" />

                <div className="form-row">
                    <div className="form-group">
                        <label>Rank</label>
                        <select name="rank" value={formData.rank ?? 0} onChange={handleChange}>
                            <option value={0}>0 - Message</option>
                            <option value={1}>1 - Session Summary</option>
                            <option value={2}>2 - LTM Summary</option>
                        </select>
                    </div>
                     <div className="form-group">
                        <label>Source</label>
                        <input type="text" name="source" value={formData.source || ''} onChange={handleChange} />
                    </div>
                </div>

                <label>Group ID</label>
                 <input
                    type="text"
                    name="group_id"
                    value={formData.group_id || ''}
                    onChange={handleChange}
                    placeholder={
                        formData.rank == 0 ? "Session ID or leave blank" :
                        formData.rank == 1 ? "LTM ID or JSON list ['ltm1', 'ltm2']" :
                        formData.rank == 2 ? "LTM ID or leave blank" :
                        "Group ID"
                     }
                 />
                 <small>For Rank 1, enter a single LTM ID or a JSON list like `["ltm1", "ltm2"]`.</small>

                 <div className="form-row">
                     <div className="form-group">
                         <label>Parent ID</label>
                         <input type="text" name="parent_id" value={formData.parent_id || ''} onChange={handleChange} placeholder="Optional"/>
                     </div>
                     <div className="form-group">
                        <label>Children IDs (JSON Array)</label>
                        <input type="text" name="children_ids" value={formData.children_ids || '[]'} onChange={handleJsonChange} />
                    </div>
                </div>

                 <div className="form-row">
                    <div className="form-group">
                        <label>Previous Sibling ID</label>
                        <input type="text" name="pre_id" value={formData.pre_id || ''} onChange={handleChange} placeholder="Optional"/>
                    </div>
                    <div className="form-group">
                        <label>Next Sibling ID</label>
                        <input type="text" name="next_id" value={formData.next_id || ''} onChange={handleChange} placeholder="Optional"/>
                    </div>
                </div>

                <label>Metadata (JSON Object)</label>
                <textarea name="metadata" value={formData.metadata || '{}'} onChange={handleJsonChange} rows="3" />

                 <div className="form-row">
                    <div className="form-group">
                        <label>Visit Count</label>
                        <input type="number" name="visit_count" value={formData.visit_count ?? 0} onChange={handleChange} min="0" />
                    </div>
                    <div className="form-group">
                        <label>Last Visit (Timestamp)</label>
                        <input type="number" name="last_visit" value={formData.last_visit ?? 0} onChange={handleChange} min="0" />
                    </div>
                 </div>

                 <div className="form-row">
                     <div className="form-group">
                        <label>End Time (ISO Format)</label>
                        <input type="text" name="end_time" value={formData.end_time || ''} onChange={handleChange} placeholder="Optional, YYYY-MM-DDTHH:MM:SS"/>
                    </div>
                    <div className="form-group checkbox-group">
                        <label>
                            <input type="checkbox" name="never_delete" checked={formData.never_delete == 1} onChange={handleChange} />
                            Never Delete
                        </label>
                    </div>
                </div>


                <div className="form-actions">
                    <button type="submit">{isEditMode ? "Enqueue Update" : "Enqueue Create"}</button>
                    <button type="button" onClick={onClose}>Cancel</button>
                </div>
            </form>
        </Modal>
    );
}

export default MemoryUnitForm;