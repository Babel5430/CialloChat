import React, { useState, useEffect } from 'react';
import Modal from './Modal';

function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    showCheckbox = false,
    checkboxLabel = "Apply this action?",
}) {
    const [isChecked, setIsChecked] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsChecked(false);
        }
    }, [isOpen]);

    const handleConfirm = () => {
        onConfirm(showCheckbox ? isChecked : undefined);
        // onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "Confirm Action"}>
            <p style={{ whiteSpace: 'pre-line' }}>{message || "Are you sure?"}</p>

            {showCheckbox && (
                <div className="confirmation-checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setIsChecked(e.target.checked)}
                        />
                        {checkboxLabel}
                    </label>
                </div>
            )}

            <div className="confirmation-buttons">
                <button onClick={handleConfirm} className="confirm-btn">
                    Confirm
                </button>
                <button onClick={onClose} type="button" className="cancel-btn">
                    Cancel
                </button>
            </div>
        </Modal>
    );
}

export default ConfirmationDialog;