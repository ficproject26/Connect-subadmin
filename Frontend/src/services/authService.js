import { apiRequest } from './api';

export const authService = {
  async login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      localStorage.setItem('ams_token', data.token);
      localStorage.setItem('ams_user', JSON.stringify(data.user));
    }
    return data;
  },

  async getMe() {
    return await apiRequest('/auth/me', { skipCache: true, fresh: true });
  },

  async getDemoAdmins() {
    return await apiRequest('/auth/demo-admins');
  },

  async updateProfile(profileData) {
    return await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  async changePassword(passwordData) {
    return await apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData)
    });
  },

  logout() {
    localStorage.removeItem('ams_token');
    localStorage.removeItem('ams_user');
  },

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('ams_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse ams_user from localStorage', e);
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('ams_token');
  }
};
