import { configureStore } from '@reduxjs/toolkit';
import appVersionReducer from './appVersionSlice';

export const store = configureStore({
  reducer: {
    appVersion: appVersionReducer,
  },
});

export default store;
