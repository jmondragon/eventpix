import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Event, Photo, Invitation } from './types';
import PocketBase from 'pocketbase';

// Initialize PocketBase client
const pb = new PocketBase('/');
pb.autoCancellation(false);

// Define the DataContextType based on the full implementation provided
interface DataContextType {
    user: any;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    listEvents: () => Promise<Event[]>;
    getEvent: (id: string) => Promise<Event>;
    createEvent: (data: Partial<Event>) => Promise<Event>;
    updateEvent: (id: string, data: Partial<Event>) => Promise<Event>;
    deleteEvent: (id: string) => Promise<void>;
    listPendingPhotos: () => Promise<Photo[]>;
    listEventPhotos: (eventId: string) => Promise<Photo[]>;
    listApprovedPhotos: (eventId: string) => Promise<Photo[]>;
    deletePhoto: (id: string) => Promise<void>;
    updatePhotoStatus: (id: string, status: string) => Promise<Photo>;
    getPhotoUrl: (photo: Photo) => string;
    subscribeToPhotos: (callback: (data: any) => void) => () => void;
    // Auth Helpers
    getAuthStoreIsValid: () => boolean;
    getUser: () => any;
    onAuthChange: (callback: (model: any) => void) => () => void;
    listAuthMethods: () => Promise<any>;
    authWithOAuth2: (provider: string) => Promise<void>;
    // Invitations
    listInvitations: (eventId: string) => Promise<Invitation[]>;
    createInvitation: (eventId: string, email: string) => Promise<Invitation>;
    deleteInvitation: (id: string) => Promise<void>;
    getStats: () => Promise<any>;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(pb.authStore.model);

    useEffect(() => {
        return pb.authStore.onChange((_token, model) => {
            setUser(model);
        });
    }, []);

    const value: DataContextType = {
        user,
        login: async (email, password) => {
            await pb.collection('users').authWithPassword(email, password);
        },
        logout: () => {
            pb.authStore.clear();
        },
        listEvents: async () => {
            const records = await pb.collection('events').getFullList({
                sort: '-created',
            });

            // Enrich with photo counts
            const eventsWithCounts = await Promise.all(records.map(async (event) => {
                try {
                    const result = await pb.collection('photos').getList(1, 1, {
                        filter: `event = "${event.id}" && status = "approved"`,
                    });
                    return { ...event, photoCount: result.totalItems };
                } catch (e) {
                    console.error(`Failed to get count for event ${event.id}`, e);
                    return { ...event, photoCount: 0 };
                }
            }));

            return eventsWithCounts as unknown as Event[];
        },
        getEvent: async (id) => {
            const record = await pb.collection('events').getOne(id);
            return record as unknown as Event;
        },
        createEvent: async (data) => {
            // Ensure owner is set to current user if not provided
            const eventData = {
                ...data,
                owner: pb.authStore.model?.id
            };
            const record = await pb.collection('events').create(eventData);
            return record as unknown as Event;
        },
        updateEvent: async (id, data) => {
            const record = await pb.collection('events').update(id, data);
            return record as unknown as Event;
        },
        deleteEvent: async (id) => {
            await pb.collection('events').delete(id);
        },
        listEventPhotos: async (eventId) => {
            const records = await pb.collection('photos').getFullList({
                filter: `event = "${eventId}"`,
                sort: '-created',
                expand: 'owner'
            });
            return records as unknown as Photo[];
        },
        listApprovedPhotos: async (eventId) => {
            const records = await pb.collection('photos').getFullList({
                filter: `event = "${eventId}" && status = "approved"`,
                sort: '-created'
            });
            return records as unknown as Photo[];
        },
        listPendingPhotos: async () => {
            const records = await pb.collection('photos').getFullList({
                filter: `status = "pending"`,
                sort: '-created',
                expand: 'owner,event'
            });
            return records as unknown as Photo[];
        },
        deletePhoto: async (id) => {
            await pb.collection('photos').delete(id);
        },
        updatePhotoStatus: async (id, status) => {
            const record = await pb.collection('photos').update(id, { status });
            return record as unknown as Photo;
        },
        getPhotoUrl: (photo: any) => pb.files.getUrl(photo, photo.file),
        subscribeToPhotos: (callback) => {
            pb.collection('photos').subscribe('*', callback);
            return () => {
                pb.collection('photos').unsubscribe();
            };
        },
        // Auth Helpers for AuthProvider
        getAuthStoreIsValid: () => pb.authStore.isValid,
        getUser: () => pb.authStore.model,
        onAuthChange: (callback: (model: any) => void) => {
            return pb.authStore.onChange((_token, model) => {
                callback(model);
            });
        },
        listAuthMethods: async () => {
            return await pb.collection('users').listAuthMethods();
        },
        authWithOAuth2: async (provider: string) => {
            await pb.collection('users').authWithOAuth2({ provider });
        },
        // Invitations
        listInvitations: async (eventId) => {
            const records = await pb.collection('invitations').getFullList({
                filter: `event = "${eventId}"`,
                sort: '-created'
            });
            return records as unknown as Invitation[];
        },
        createInvitation: async (eventId, email) => {
            const record = await pb.collection('invitations').create({
                event: eventId,
                email: email
            });
            return record as unknown as Invitation;
        },
        deleteInvitation: async (id) => {
            await pb.collection('invitations').delete(id);
        },
        getStats: async () => {
            const [events, photos, users, pending] = await Promise.all([
                pb.collection('events').getList(1, 1),
                pb.collection('photos').getList(1, 1),
                pb.collection('users').getList(1, 1),
                pb.collection('photos').getList(1, 1, { filter: 'status = "pending"' })
            ]);

            return {
                totalEvents: events.totalItems,
                totalPhotos: photos.totalItems,
                totalUsers: users.totalItems,
                pendingPhotos: pending.totalItems
            };
        }
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

// Backwards compatibility wrapper if needed, or strictly for main.tsx if it uses this name
export function DataProviderWrapper({ children }: { children: React.ReactNode }) {
    return <DataProvider>{children}</DataProvider>;
}
