import axios from 'axios';
import config from '../config'; 
const API_URL = `${config.API_BASE_URL}/memory_editor`;

// --- Task Queue ---
export const getTasks = () => axios.get(`${API_URL}/tasks`);
export const confirmTask = (taskId) => axios.post(`${API_URL}/tasks/${taskId}/confirm`);
export const cancelTask = (taskId) => axios.delete(`${API_URL}/tasks/${taskId}/cancel`);

/**
 * Confirms multiple tasks by sending individual requests.
 * @param {string[]} taskIds - Array of task IDs to confirm.
 * @returns {Promise<object[]>} - Array of results (success/error for each task).
 */
export const confirmMultipleTasks = async (taskIds) => {
    const results = [];
    for (const taskId of taskIds) {
        try {
            const res = await confirmTask(taskId);
            results.push({ taskId, status: 'success', data: res.data });
        } catch (error) {
            results.push({ taskId, status: 'error', error: handleApiError(error) });
        }
    }
    return results;
};

/**
 * Cancels multiple tasks by sending individual requests.
 * @param {string[]} taskIds - Array of task IDs to cancel.
 * @returns {Promise<object[]>} - Array of results (success/error for each task).
 */
export const cancelMultipleTasks = async (taskIds) => {
    const results = [];
    for (const taskId of taskIds) {
        try {
            const res = await cancelTask(taskId);
            results.push({ taskId, status: 'success', data: res.data });
        } catch (error) {
            results.push({ taskId, status: 'error', error: handleApiError(error) });
        }
    }
    return results;
};


// --- Memory Units ---
export const getMemoryUnits = (params = {}) => axios.get(`${API_URL}/memory_units`, { params });
export const getMemoryUnit = (id) => axios.get(`${API_URL}/memory_units/${id}`);
export const enqueueCreateMemoryUnit = (data) => axios.post(`${API_URL}/memory_units`, data);
export const enqueueUpdateMemoryUnit = (id, data) => axios.put(`${API_URL}/memory_units/${id}`, data);
export const enqueueDeleteMemoryUnit = (id) => axios.delete(`${API_URL}/memory_units/${id}`);
export const enqueueBatchDeleteUnits = (ids) => axios.post(`${API_URL}/batch/delete_units`, { ids });

// --- Sessions ---
export const getSessions = () => axios.get(`${API_URL}/sessions`);
export const getSession = (id) => axios.get(`${API_URL}/sessions/${id}`); 
export const enqueueCreateSession = (data) => axios.post(`${API_URL}/sessions`, data);
export const enqueueUpdateSession = (id, data) => axios.put(`${API_URL}/sessions/${id}`, data);
export const enqueueDeleteSession = (id, deleteUnits = false) => axios.delete(`${API_URL}/sessions/${id}?delete_units=${deleteUnits}`);
export const enqueueMoveUnitToSession = (sessionId, unitId) => axios.post(`${API_URL}/sessions/${sessionId}/move_unit/${unitId}`);

// --- Long Term Memories (LTMs) ---
export const getLtms = () => axios.get(`${API_URL}/ltms`);
export const getLtm = (id) => axios.get(`${API_URL}/ltms/${id}`);
export const enqueueCreateLtm = (data) => axios.post(`${API_URL}/ltms`, data);
export const enqueueUpdateLtm = (id, data) => axios.put(`${API_URL}/ltms/${id}`, data);
export const enqueueDeleteLtm = (id) => axios.delete(`${API_URL}/ltms/${id}`);
export const enqueueAddSessionsToLtm = (ltmId, sessionIds) => axios.post(`${API_URL}/ltms/${ltmId}/add_sessions`, { session_ids: sessionIds });

// --- System ---
/**
 * Sends a request to close the memory system.
 */
export const closeSystem = () => axios.post(`${API_URL}/close`);


// Helper to handle API errors
export const handleApiError = (error, customMessage = "An API error occurred") => {
    console.error(customMessage, error);
    if (error.response) {
        console.error("Data:", error.response.data);
        console.error("Status:", error.response.status);
        console.error("Headers:", error.response.headers);
        return error.response.data?.error || error.response.data?.message || `Server Error: ${error.response.status}`;
    } else if (error.request) {
        console.error("Request:", error.request);
        return "No response received from server.";
    } else {
        console.error('Error', error.message);
        return error.message;
    }
};