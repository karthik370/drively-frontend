import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type NotificationType = 'success' | 'info' | 'warning' | 'error' | 'booking_request' | 'support_chat';

export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: string;
  bookingId?: string;
  supportThreadUserId?: string;
};

type NotificationState = {
  items: AppNotification[];
};

const initialState: NotificationState = {
  items: [],
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification: (
      state,
      action: PayloadAction<{ type: NotificationType; message: string; bookingId?: string; supportThreadUserId?: string }>
    ) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      state.items.unshift({
        id,
        type: action.payload.type,
        message: action.payload.message,
        bookingId: action.payload.bookingId,
        supportThreadUserId: action.payload.supportThreadUserId,
        createdAt: new Date().toISOString(),
      });
      state.items = state.items.slice(0, 50);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((n) => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.items = [];
    },
  },
});

export const { addNotification, removeNotification, clearNotifications } = notificationSlice.actions;

export default notificationSlice.reducer;
