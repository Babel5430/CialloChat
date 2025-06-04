import config from '../config';
const API_BASE_URL = `${config.API_BASE_URL}/standard_answer`; // **Ensure this matches your Flask app.py port**

export const fetchRoles = async () => {
  const response = await fetch(`${API_BASE_URL}/roles`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return await response.json(); // Returns list of role names
};

export const fetchRoleQNA = async (roleName) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/qna`);
     if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json(); // Returns { "input": ["answer1", ...], ... }
};

export const addStandardInput = async (roleName, input) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const updateStandardInput = async (roleName, oldInput, newInput) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/input`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ old_input: oldInput, new_input: newInput }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};


export const deleteStandardInput = async (roleName, input) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/input`, {
      method: 'DELETE',
       headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const addStandardAnswer = async (roleName, input, answer) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, answer }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const updateStandardAnswer = async (roleName, input, index, newAnswer) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/answer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, index, new_answer: newAnswer }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const deleteStandardAnswer = async (roleName, input, index) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/answer`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, index }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};