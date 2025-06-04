import config from '../config';

const API_BASE_URL = `${config.API_BASE_URL}/role_graph`; 
export const fetchGraph = async () => {
  const response = await fetch(`${API_BASE_URL}/graph`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

export const fetchRoles = async () => {
    const response = await fetch(`${API_BASE_URL}/roles`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  };


export const addRole = async (roleName) => {
  const response = await fetch(`${API_BASE_URL}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role_name: roleName }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

export const deleteRole = async (roleName) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  };


export const addAttributeDescription = async (roleName, attributeName, description, accessRights) => {
    const payload = {
      attribute_name: attributeName,
      description: description,
      access_rights: accessRights // Can be "unlimited", list of role names, or null/undefined
    };
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/attribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const addIdea = async (sourceRole, targetRole, idea) => {
    const response = await fetch(`${API_BASE_URL}/role/${sourceRole}/idea`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target_role: targetRole, idea: idea }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  };

  export const addDescriptionForOtherRole = async (sourceRole, targetRole, attributeName, description) => {
    const payload = {
      attribute_name: attributeName,
      description: description
    };
    const response = await fetch(`${API_BASE_URL}/role/${sourceRole}/add_description_for/${targetRole}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};


export const parseRoleAttributes = async (roleName) => {
    const response = await fetch(`${API_BASE_URL}/parse/attributes/${roleName}`, {
      method: 'POST', // Using POST as it might involve processing state
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json(); // Returns a list of strings
  };

  export const parseAccessibleDescriptions = async (roleName) => {
    const response = await fetch(`${API_BASE_URL}/parse/accessible_descriptions/${roleName}`, {
      method: 'POST', // Using POST
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json(); // Returns a list of strings
  };

  export const parseIdeasBetweenRoles = async (sourceRole, targetRole) => {
    const response = await fetch(`${API_BASE_URL}/parse/ideas/${sourceRole}/${targetRole}`, {
      method: 'POST', // Using POST
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json(); // Returns a list of strings
  };

  export const saveGraph = async () => {
    const response = await fetch(`${API_BASE_URL}/save`, {
      method: 'POST',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  };

  export const deleteAttribute = async (roleName, attributeName) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/attribute/${attributeName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const deleteDescription = async (roleName, attributeName, index) => {
    const response = await fetch(`${API_BASE_URL}/role/${roleName}/attribute/${attributeName}/description/${index}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const deleteIdeasToRole = async (sourceRole, targetRole) => {
    const response = await fetch(`${API_BASE_URL}/role/${sourceRole}/ideas_to/${targetRole}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};

export const deleteSpecificIdea = async (sourceRole, targetRole, index) => {
    const response = await fetch(`${API_BASE_URL}/role/${sourceRole}/idea_to/${targetRole}/${index}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
};