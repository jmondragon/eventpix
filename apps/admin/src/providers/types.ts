export interface User {
    id: string;
    email: string;
    name?: string;
}

export interface Event {
    id: string;
    name: string;
    code: string;
    visibility: 'public' | 'unlisted' | 'private';
    join_mode: 'open' | 'pin' | 'invite_only';
    pin?: string;
    approval_required: boolean;
    allow_anonymous_uploads: boolean;
    storage_limit_mb: number;
    created: string;
    photoCount?: number;
}

export interface Photo {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    file: string;
    caption?: string;
    event: string;
    owner: string;
    status: 'pending' | 'approved' | 'rejected';
    expand?: {
        owner?: User;
        event?: Event;
    };
    likes?: string[];
}

export interface Invitation {
    id: string;
    created: string;
    updated: string;
    event: string;
    email: string;
}

export interface RealtimeEvent {
    action: 'create' | 'update' | 'delete';
    record: any;
}

export interface DataContextType {
    action: 'create' | 'update' | 'delete';
    record: any;
}

export interface DataProvider {
    // Auth
    login(email: string, pass: string): Promise<void>;
    listAuthMethods(): Promise<any>;
    authWithOAuth2(provider: string): Promise<void>;
    logout(): void;
    onAuthChange(callback: (user: User | null) => void): () => void;
    getUser(): User | null;
    getAuthStoreIsValid(): boolean;

    // Events
    listEvents(): Promise<Event[]>;
    getEvent(id: string): Promise<Event>;
    createEvent(data: Partial<Event>): Promise<Event>;
    updateEvent(id: string, data: Partial<Event>): Promise<Event>;
    deleteEvent(id: string): Promise<void>;

    // Photos
    listPendingPhotos(): Promise<Photo[]>;
    listEventPhotos(eventId: string): Promise<Photo[]>;
    listApprovedPhotos(eventId: string): Promise<Photo[]>;
    updatePhotoStatus(id: string, status: Photo['status']): Promise<void>;
    deletePhoto(id: string): Promise<void>;
    getPhotoUrl(photo: Photo): string;

    // Realtime
    subscribeToPhotos(callback: (e: RealtimeEvent) => void): () => void;

    // Stats
    getStats(): Promise<DashboardStats>;
}

export interface DashboardStats {
    totalEvents: number;
    totalPhotos: number;
    totalUsers: number;
    pendingPhotos: number;
}
