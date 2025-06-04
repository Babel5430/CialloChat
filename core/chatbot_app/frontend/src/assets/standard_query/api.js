import config from '../config';
const API_BASE_URL = `${config.API_BASE_URL}/standard_query`; // **Ensure this matches your Flask app.py port**

export const fetchRoles = async () => {
  const response = await fetch(`${API_BASE_URL}/roles`);
  if (!response.ok) {
    let errorMsg = `HTTP error! status: ${response.status}`;
    try {
        const errorBody = await response.json();
        errorMsg = errorBody.error || errorMsg;
    } catch (e) {
    }
    throw new Error(errorMsg);
  }
  return await response.json(); // Returns list of role names
};

export const fetchRoleConcepts = async (roleName) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/concepts`);
    if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch (e) {
        }
        throw new Error(errorMsg);
    }
    return await response.json(); 
};

export const fetchRoleQueries = async (roleName) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/queries`);
     if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch (e) {
        }
    }
    return await response.json(); // Returns { "concept": ["query1", ...], ... }
};

export const addOrUpdateQuery = async (roleName, concept, query, index = null) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ concept, query, index }),
    });
    if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch (e) {
        }
        throw new Error(errorMsg);
    }
    return await response.json();
};

export const deleteQuery = async (roleName, concept, index) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/delete_query`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ concept, index }),
    });
    if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch (e) {
        }
        throw new Error(errorMsg);
    }
    return await response.json();
};