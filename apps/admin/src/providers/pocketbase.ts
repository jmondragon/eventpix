import PocketBase from 'pocketbase';
import type { DataProvider, Event, Photo, RealtimeEvent, User } from './types';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || '/'; // Use env var, proxy in dev, or relative path in prod

export class PocketBaseProvider implements DataProvider {
    private pb: PocketBase;

    constructor() {
        this.pb = new PocketBase(PB_URL);
        this.pb.autoCancellation(false);
    }

    // --- Auth ---
    async login(email: string, pass: string): Promise<void> {
        await this.pb.collection('users').authWithPassword(email, pass);
    }

    async listAuthMethods(): Promise<any> {
        return await this.pb.collection('users').listAuthMethods();
    }

    async authWithOAuth2(provider: string): Promise<void> {
        await this.pb.collection('users').authWithOAuth2({ provider });
    }

    logout(): void {
        this.pb.authStore.clear();
    }

    onAuthChange(callback: (user: User | null) => void): () => void {
        return this.pb.authStore.onChange((_token, model) => {
            callback(model as User | null);
        });
    }

    getUser(): User | null {
        return this.pb.authStore.model as User | null;
    }

    getAuthStoreIsValid(): boolean {
        return this.pb.authStore.isValid;
    }

    // --- Events ---
    async listEvents(): Promise<Event[]> {
        return await this.pb.collection('events').getFullList();
    }

    async getEvent(id: string): Promise<Event> {
        return await this.pb.collection('events').getOne(id);
    }

    async createEvent(data: Partial<Event>): Promise<Event> {
        return await this.pb.collection('events').create(data);
    }

    async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
        return await this.pb.collection('events').update(id, data);
    }

    async deleteEvent(id: string): Promise<void> {
        await this.pb.collection('events').delete(id);
    }

    // --- Photos ---
    async listPendingPhotos(): Promise<Photo[]> {
        return await this.pb.collection('photos').getFullList({
            filter: 'status = "pending"',
            expand: 'event,owner',
            sort: '-created',
        });
    }

    async listEventPhotos(eventId: string): Promise<Photo[]> {
        return await this.pb.collection('photos').getFullList({
            filter: `event = "${eventId}"`,
            sort: '-created',
            expand: 'owner',
        });
    }

    async listApprovedPhotos(eventId: string): Promise<Photo[]> {
        return await this.pb.collection('photos').getFullList({
            filter: `event = "${eventId}" && status = "approved"`,
            sort: '-created',
        });
    }

    async updatePhotoStatus(id: string, status: Photo['status']): Promise<void> {
        await this.pb.collection('photos').update(id, { status });
    }

    async deletePhoto(id: string): Promise<void> {
        await this.pb.collection('photos').delete(id);
    }

    getPhotoUrl(photo: Photo): string {
        return this.pb.files.getUrl(photo, photo.file);
    }

    // --- Realtime ---
    subscribeToPhotos(callback: (e: RealtimeEvent) => void): () => void {
        const unsubPromise = this.pb.collection('photos').subscribe('*', (e) => {
            callback({
                action: e.action as any,
                record: e.record,
            });
        });

        return () => {
            unsubPromise.then(unsub => unsub());
        };
    }
    // --- Stats ---
    async getStats(): Promise<import('./types').DashboardStats> {
        // Parallel requests for efficiency
        const [events, photos, users, pending] = await Promise.all([
            this.pb.collection('events').getList(1, 1, { skipTotal: false }),
            this.pb.collection('photos').getList(1, 1, { skipTotal: false }),
            this.pb.collection('users').getList(1, 1, { skipTotal: false }),
            this.pb.collection('photos').getList(1, 1, { filter: 'status = "pending"', skipTotal: false }),
        ]);

        return {
            totalEvents: events.totalItems,
            totalPhotos: photos.totalItems,
            totalUsers: users.totalItems,
            pendingPhotos: pending.totalItems,
        };
    }
}
