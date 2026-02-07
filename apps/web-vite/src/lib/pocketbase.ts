import PocketBase from 'pocketbase';

// Use environment variable or default to local backend
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Helper to get the current auth model safely
export const getUser = () => {
    return pb.authStore.model;
}

export const isAuthenticated = () => {
    return pb.authStore.isValid;
}
