import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { logout, loadUser } from './authSlice';
import { getDriverDocumentsStatus } from '../../services/api';

export type DriverVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export type DriverVerificationState = {
  documentsVerified: boolean;
  backgroundCheckStatus: DriverVerificationStatus;
  submitted: boolean;
  updatedAt: string | null;
  reason: string | null;
  isLoading: boolean;
  hydrated: boolean;
};

interface DriverState {
  isOnline: boolean;
  verification: DriverVerificationState;
}

const initialState: DriverState = {
  isOnline: false,
  verification: {
    documentsVerified: false,
    backgroundCheckStatus: 'PENDING',
    submitted: false,
    updatedAt: null,
    reason: null,
    isLoading: false,
    hydrated: false,
  },
};

export const loadDriverVerificationStatus = createAsyncThunk(
  'driver/loadDriverVerificationStatus',
  async (_, { rejectWithValue }) => {
    try {
      const status = await getDriverDocumentsStatus();
      return status;
    } catch (e: any) {
      return rejectWithValue(e?.message || 'Failed to load verification status');
    }
  }
);

const driverSlice = createSlice({
  name: 'driver',
  initialState,
  reducers: {
    setDriverOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setDriverVerification: (state, action: PayloadAction<Partial<Omit<DriverVerificationState, 'isLoading'>>>) => {
      state.verification = {
        ...state.verification,
        ...action.payload,
      } as any;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.pending, (state) => {
        state.isOnline = false;
        state.verification = { ...initialState.verification };
      })
      .addCase(logout.fulfilled, (state) => {
        state.isOnline = false;
        state.verification = { ...initialState.verification };
      })
      .addCase(logout.rejected, (state) => {
        state.isOnline = false;
        state.verification = { ...initialState.verification };
      })
      .addCase(loadUser.rejected, (state) => {
        state.isOnline = false;
        state.verification = { ...initialState.verification };
      })
      .addCase(loadDriverVerificationStatus.pending, (state) => {
        state.verification.isLoading = true;
      })
      .addCase(loadDriverVerificationStatus.fulfilled, (state, action) => {
        state.verification.isLoading = false;
        state.verification.hydrated = true;
        state.verification.documentsVerified = Boolean((action.payload as any)?.documentsVerified);
        state.verification.backgroundCheckStatus = String((action.payload as any)?.backgroundCheckStatus || 'PENDING') as any;
        state.verification.submitted = Boolean((action.payload as any)?.submitted);
        state.verification.updatedAt = typeof (action.payload as any)?.updatedAt === 'string' ? (action.payload as any).updatedAt : null;
        state.verification.reason = typeof (action.payload as any)?.rejectionReason === 'string' ? (action.payload as any).rejectionReason : null;
      })
      .addCase(loadDriverVerificationStatus.rejected, (state) => {
        state.verification.isLoading = false;
        state.verification.hydrated = true;
      });
  },
});

export const { setDriverOnline, setDriverVerification } = driverSlice.actions;
export default driverSlice.reducer;
