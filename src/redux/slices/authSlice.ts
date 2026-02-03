import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../../services/authService';
import { User, AuthState } from '../../types';

const ROLE_OVERRIDE_KEY = 'roleOverride';

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  roleOverride: null,
};

export const verifyMsg91AccessToken = createAsyncThunk(
  'auth/verifyMsg91AccessToken',
  async (
    { accessToken, phoneNumber }: { accessToken: string; phoneNumber?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.verifyMsg91AccessToken(accessToken, phoneNumber);
      const data = response.data.data as any;

      if (data?.accessToken && data?.refreshToken) {
        await SecureStore.setItemAsync('accessToken', data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      }

      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const signup = createAsyncThunk(
  'auth/signup',
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await authService.signup(data);
      await SecureStore.setItemAsync('accessToken', response.data.data.accessToken);
      await SecureStore.setItemAsync('refreshToken', response.data.data.refreshToken);

      return { ...response.data.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Signup failed');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (data: { phoneNumber: string; password?: string }, { rejectWithValue }) => {
    try {
      const response = await authService.login(data);
      await SecureStore.setItemAsync('accessToken', response.data.data.accessToken);
      await SecureStore.setItemAsync('refreshToken', response.data.data.refreshToken);

      return { ...response.data.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      await authService.logout(state.auth.refreshToken!);
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync(ROLE_OVERRIDE_KEY);
      return null;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);

export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const roleOverrideRaw = await SecureStore.getItemAsync(ROLE_OVERRIDE_KEY);
      
      if (!accessToken || !refreshToken) {
        throw new Error('No tokens found');
      }

      const response = await authService.getMe();

      return {
        user: response.data.data,
        accessToken,
        refreshToken,
        roleOverride: roleOverrideRaw || null,
      };
    } catch (error: any) {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync(ROLE_OVERRIDE_KEY);
      return rejectWithValue(error.response?.data?.message || 'Failed to load user');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setRoleOverride: (state, action: PayloadAction<string | null>) => {
      state.roleOverride = action.payload as any;
      if (action.payload) {
        void SecureStore.setItemAsync(ROLE_OVERRIDE_KEY, String(action.payload));
      } else {
        void SecureStore.deleteItemAsync(ROLE_OVERRIDE_KEY);
      }
    },
    clearRoleOverride: (state) => {
      state.roleOverride = null;
      void SecureStore.deleteItemAsync(ROLE_OVERRIDE_KEY);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifyMsg91AccessToken.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyMsg91AccessToken.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.accessToken && action.payload?.refreshToken) {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.isAuthenticated = true;
        }
      })
      .addCase(verifyMsg91AccessToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(signup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(signup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.roleOverride = null;
      })
      .addCase(loadUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.roleOverride = (action.payload as any).roleOverride || null;
      })
      .addCase(loadUser.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.roleOverride = null;
      });
  },
});

export const { clearError, updateUser, setRoleOverride, clearRoleOverride } = authSlice.actions;
export default authSlice.reducer;
