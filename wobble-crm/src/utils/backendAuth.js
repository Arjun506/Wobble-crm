/**
 * Backend auth API client
 * Communicates with local server auth endpoints
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export async function loginWithBackend(email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        return { success: false, error: parsed.error || parsed.message || `Server error: ${response.status}` };
      } catch (e) {
        return { success: false, error: `Server error: ${response.status}: ${text}` };
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend login error:', error);
    return { success: false, error: 'Network error. Check server is running on port 5000.' };
  }
}

export async function createUserOnBackend(email, password, role, name) {
  try {
    const response = await fetch(`${API_BASE}/auth/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, name }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend create user error:', error);
    return { success: false, error: 'Network error. Check server is running.' };
  }
}

export async function changePasswordOnBackend(email, newPassword) {
  try {
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend change password error:', error);
    return { success: false, error: 'Network error. Check server is running.' };
  }
}

export async function deleteUserOnBackend(email) {
  try {
    const response = await fetch(`${API_BASE}/auth/delete-user`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend delete user error:', error);
    return { success: false, error: 'Network error. Check server is running.' };
  }
}

export async function listUsersOnBackend() {
  try {
    const response = await fetch(`${API_BASE}/auth/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend list users error:', error);
    return { success: false, error: 'Network error. Check server is running.' };
  }
}
