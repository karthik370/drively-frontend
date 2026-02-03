import api from './api';
import { ApiResponse } from '../types';

export const authService = {
  verifyMsg91AccessToken: (accessToken: string, phoneNumber?: string) => {
    return api.post<ApiResponse>('/auth/msg91/verify-access-token', {
      accessToken,
      phoneNumber,
    });
  },

  signup: (data: any) => {
    return api.post<ApiResponse>('/auth/signup', data);
  },

  login: (data: { phoneNumber: string; password?: string }) => {
    return api.post<ApiResponse>('/auth/login', data);
  },

  logout: (refreshToken: string) => {
    return api.post<ApiResponse>('/auth/logout', { refreshToken });
  },

  getMe: () => {
    return api.get<ApiResponse>('/auth/me');
  },

  socialLogin: (data: any) => {
    return api.post<ApiResponse>('/auth/social-login', data);
  },
};
