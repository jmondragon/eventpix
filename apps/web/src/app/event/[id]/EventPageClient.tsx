"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pb, isAuthenticated, getUser } from '@/lib/pocketbase';
import { useSnackbar } from 'notistack';
import PhotoCard from '@/components/PhotoCard';
import UserProfile from '@/components/UserProfile';
import QRCode from "react-qr-code";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Helper for datetime-local input
const toLocalISO = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function EventPage({ id: propId }: { id?: string }) {
    const params = useParams();
    const router = useRouter();
    const id = propId || params.id as string;
    const { enqueueSnackbar } = useSnackbar();
    const [event, setEvent] = useState<any>(null);
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Edit State
    const [isEditingEvent, setIsEditingEvent] = useState(false);
    const [editEventName, setEditEventName] = useState('');
    const [editVisibility, setEditVisibility] = useState('public');
    const [editJoinMode, setEditJoinMode] = useState('open');
    const [editPin, setEditPin] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');

    // Share State
    const [isSharing, setIsSharing] = useState(false);


    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        await uploadFiles(Array.from(files));
    };

    const handleCameraClick = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera
            });

            if (image.webPath) {
                // Convert to File object
                const response = await fetch(image.webPath);
                const blob = await response.blob();
                const file = new File([blob], `capture-${Date.now()}.${image.format}`, { type: `image/${image.format}` });
                await uploadFiles([file]);
            }
        } catch (err) {
            console.error("Camera capture failed", err);
            // User cancelled or error
        }
    };

    const uploadFiles = async (files: File[]) => {
        setUploading(true);
        let successCount = 0;

        // Notification for batch start if multiple
        if (files.length > 1) {
            enqueueSnackbar(`Uploading ${files.length} photos...`, { variant: 'info' });
        }

        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('event', id);
                const userId = getUser()?.id;
                const isOwner = event?.owner && userId === event.owner;

                if (userId) {
                    formData.append('owner', userId);
                }

                // Auto-approve if owner, otherwise check event settings
                const status = (event?.approval_required && !isOwner) ? 'pending' : 'approved';
                formData.append('status', status);

                await pb.collection('photos').create(formData);
                successCount++;

            } catch (err) {
                console.error("Upload failed for file", file.name, err);
            }
        }

        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (successCount === 0) {
            enqueueSnackbar("Upload failed.", { variant: 'error' });
        } else if (successCount === files.length) {
            const msg = files.length === 1 ? "Photo uploaded successfully!" : `${successCount} photos uploaded successfully!`;
            enqueueSnackbar(msg, { variant: 'success' });

            // Check if any need approval (heuristic: if not owner and approval required)
            const userId = getUser()?.id;
            const isOwner = event?.owner && userId === event.owner;
            if (event?.approval_required && !isOwner) {
                enqueueSnackbar("Waiting for host approval.", { variant: 'info' });
            }

        } else {
            enqueueSnackbar(`Uploaded ${successCount} of ${files.length} photos.`, { variant: 'warning' });
        }
    };

    // Restoring missing fetch logic
    useEffect(() => {
        const loadEvent = async () => {
            try {
                // Fetch event
                const eventRecord = await pb.collection('events').getOne(id);
                // Do NOT set event state yet.

                // Check Access Control
                if (eventRecord.join_mode === 'invite_only') {
                    if (!isAuthenticated()) {
                        setEvent(eventRecord); // Need event for restricted UI (shows name)
                        setLoading(false);
                        return; // Will show restricted UI
                    }
                    const user = getUser();
                    // Check if invited OR owner
                    if (eventRecord.owner === user?.id) {
                        // Owner always allowed
                    } else {
                        try {
                            const invites = await pb.collection('invitations').getList(1, 1, {
                                filter: `event = "${id}" && email = "${user?.email}"`
                            });
                            if (invites.items.length === 0) {
                                setError("Access Denied: You are not on the guest list.");
                                setLoading(false);
                                return;
                            }
                        } catch (err) {
                            console.error("Failed to check invitations", err);
                            setError("Access Denied: Could not verify invitation.");
                            setLoading(false);
                            return;
                        }
                    }
                } else if (eventRecord.join_mode === 'pin') {
                    // Check if already joined via LocalStorage (simulating app persistence)
                    const joinedEvents = JSON.parse(localStorage.getItem('joined_events') || '[]');
                    const user = getUser();
                    // Allow if owner OR if present in local storage
                    if (eventRecord.owner !== user?.id && !joinedEvents.includes(eventRecord.id)) {
                        // Redirect to Join Page with Code
                        console.log("PIN required, redirecting to join page...");
                        router.push(`/join/${eventRecord.code}`);
                        // Do NOT set event state.
                        // Do NOT set loading to false.
                        // allow redirect to happen while showing loading spinner
                        return;
                    }
                }

                // If we got here, access is granted.
                setEvent(eventRecord);
                setEditEventName(eventRecord.name);
                setEditVisibility(eventRecord.visibility);
                setEditJoinMode(eventRecord.join_mode);
                setEditPin(eventRecord.pin || '');
                setEditDescription(eventRecord.description || '');
                setEditStartDate(toLocalISO(eventRecord.start_date));
                setEditEndDate(toLocalISO(eventRecord.end_date));

                // Fetch photos
                const photoRecords = await pb.collection('photos').getFullList({
                    filter: `event = "${id}" && status = "approved"`,
                    sort: '-created',
                    expand: 'owner'
                });
                setPhotos(photoRecords);

                // Update loading state only after everything is ready
                setLoading(false);

                // Subscribe to realtime updates
                pb.collection('photos').subscribe('*', async function (e) {
                    if (e.record.event !== id) return;

                    if (e.action === 'create') {
                        if (e.record.status === 'approved') {
                            try {
                                const expandedRecord = await pb.collection('photos').getOne(e.record.id, {
                                    expand: 'owner'
                                });
                                setPhotos((prev) => {
                                    if (prev.some(p => p.id === expandedRecord.id)) return prev;
                                    return [expandedRecord, ...prev];
                                });
                            } catch (err) {
                                console.error("Failed to expand realtime photo", err);
                                setPhotos((prev) => {
                                    if (prev.some(p => p.id === e.record.id)) return prev;
                                    return [e.record, ...prev];
                                });
                            }
                        }
                    } else if (e.action === 'update') {
                        if (e.record.status === 'approved') {
                            // If it's already in the list, update it (caption change, likes, etc)
                            // If it's NOT in the list (just approved), add it.
                            setPhotos((prev) => {
                                const exists = prev.some(p => p.id === e.record.id);
                                if (exists) {
                                    return prev.map(p => p.id === e.record.id ? { ...p, ...e.record } : p);
                                } else {
                                    return prev; // Return prev, and let the async block below handle adding.
                                }
                            });

                            // Now for the "Add if missing" case:
                            try {
                                const expandedRecord = await pb.collection('photos').getOne(e.record.id, {
                                    expand: 'owner'
                                });
                                setPhotos((prev) => {
                                    if (prev.some(p => p.id === expandedRecord.id)) {
                                        // Update existing with full expanded data
                                        return prev.map(p => p.id === expandedRecord.id ? expandedRecord : p);
                                    }
                                    // Add new
                                    return [expandedRecord, ...prev];
                                });
                            } catch (err) {
                                console.error("Failed to fetch updated photo", err);
                            }

                        } else {
                            // Status is NOT approved (e.g. rejected or hidden)
                            // Animate exit then remove
                            setPhotos((prev) => prev.map(p => p.id === e.record.id ? { ...p, _isExiting: true } : p));
                            setTimeout(() => {
                                setPhotos((prev) => prev.filter((p) => p.id !== e.record.id));
                            }, 500);
                        }
                    } else if (e.action === 'delete') {
                        // Animate exit then remove
                        setPhotos((prev) => prev.map(p => p.id === e.record.id ? { ...p, _isExiting: true } : p));
                        setTimeout(() => {
                            setPhotos((prev) => prev.filter((p) => p.id !== e.record.id));
                        }, 500);
                    }
                });

            } catch (err) {
                console.error("Error loading event", err);
                setEvent(null);
                setLoading(false);
            }
        };

        if (id) {
            loadEvent();
        }

        return () => {
            pb.collection('photos').unsubscribe();
        };
    }, [id]);

    const handleUpdateEvent = async () => {
        if (!editEventName.trim()) return;
        if (!event) return;
        try {
            await pb.collection('events').update(event.id, {
                name: editEventName,
                visibility: editVisibility,
                join_mode: editJoinMode,
                pin: editPin,
                description: editDescription,
                start_date: editStartDate ? new Date(editStartDate).toISOString() : '',
                end_date: editEndDate ? new Date(editEndDate).toISOString() : '',
            });
            setEvent((prev: any) => ({
                ...prev,
                name: editEventName,
                visibility: editVisibility,
                join_mode: editJoinMode,
                pin: editJoinMode === 'pin' ? editPin : '',
                description: editDescription,
                start_date: editStartDate ? new Date(editStartDate).toISOString() : '',
                end_date: editEndDate ? new Date(editEndDate).toISOString() : '',
            }));
            setIsEditingEvent(false);
            enqueueSnackbar("Event updated", { variant: 'success' });
        } catch (err) {
            console.error(err);
            enqueueSnackbar("Failed to update event", { variant: 'error' });
        }
    };

    const handleDeleteEvent = async () => {
        if (!event) return;
        if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;

        try {
            await pb.collection('events').delete(event.id);
            router.push('/');
        } catch (err) {
            console.error(err);
            enqueueSnackbar("Failed to delete event", { variant: 'error' });
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center text-white">Loading Event...</div>;

    // Auth Required for Invite Only
    if (event?.join_mode === 'invite_only' && !isAuthenticated()) {
        return (
            <div className="flex flex-col h-screen items-center justify-center text-white p-4 space-y-4">
                <h1 className="text-2xl font-bold">{event.name}</h1>
                <p className="text-gray-400">This event is invite-only.</p>
                <button
                    onClick={() => router.push('/')}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg"
                >
                    Sign In to Access
                </button>
            </div>
        );
    }

    if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
    if (!event) return <div className="flex h-screen items-center justify-center text-red-500">Event not found</div>;

    const user = getUser();
    const isHost = event?.owner && user?.id === event.owner;

    return (
        <div className="min-h-screen bg-gray-950 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 p-4 h-16 relative flex items-center justify-between">
                {/* Left: Back Button */}
                <div className="w-8 z-20 relative">
                    <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                {/* Mobile: Title (Left Aligned, truncated) */}
                <div className="flex-1 min-w-0 mx-2 md:hidden">
                    <h1 className="text-lg font-bold text-white truncate text-left">{event.name}</h1>
                </div>

                {/* Desktop: Title (Absolute Center) - Hidden on mobile */}
                <div className="absolute inset-x-0 top-0 bottom-0 hidden md:flex items-center justify-center z-10 pointer-events-none px-20">
                    <h1 className="text-xl font-bold text-white text-center truncate">{event.name}</h1>
                </div>

                {/* Right: Actions */}
                <div className="flex justify-end gap-2 items-center z-20 relative">
                    <button
                        onClick={() => setIsSharing(true)}
                        className="text-gray-400 hover:text-white p-2"
                        title="Share Event"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => router.push(`/event/${id}/slideshow`)}
                        className="text-gray-400 hover:text-white p-2"
                        title="Start Slideshow"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    {isHost && (
                        <button
                            onClick={() => {
                                setEditEventName(event.name);
                                setEditVisibility(event.visibility || 'public');
                                setEditJoinMode(event.join_mode || 'open');
                                setEditPin(event.pin || '');
                                setEditDescription(event.description || '');
                                setEditStartDate(toLocalISO(event.start_date));
                                setEditEndDate(toLocalISO(event.end_date));
                                setIsEditingEvent(true);
                            }}
                            className="text-gray-400 hover:text-white p-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    )}
                    <UserProfile />
                </div>
            </header>

            {/* Event Info */}
            {(event.description || event.start_date || event.end_date) && (
                <div className="px-4 pt-6 text-center max-w-2xl mx-auto">
                    {event.description && <p className="text-gray-300 mb-3 whitespace-pre-wrap">{event.description}</p>}
                    {(event.start_date || event.end_date) && (
                        <div className="flex justify-center flex-wrap gap-4 text-xs text-gray-500 font-bold uppercase tracking-widest">
                            {event.start_date && (
                                <span>
                                    Starts: {new Date(event.start_date).toLocaleDateString()} {new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {event.end_date && (
                                <span>
                                    Ends: {new Date(event.end_date).toLocaleDateString()} {new Date(event.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Grid */}
            <main className="p-4">
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                    {photos.map(photo => (
                        <PhotoCard
                            key={photo.id}
                            photo={photo}
                            currentUserId={getUser()?.id}
                            eventOwnerId={event?.owner} // Assuming event owner is not expanded, just the ID
                        />
                    ))}
                </div>
                {
                    photos.length === 0 && (
                        <div className="text-center text-gray-500 mt-20">
                            No photos yet. Be the first to post!
                        </div>
                    )
                }
            </main>

            {/* FAB */}
            {/* FABs */}
            <div className="fixed bottom-6 right-6 flex flex-col items-center gap-4">
                {/* Secondary: Gallery */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                    multiple
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-3 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Upload from Gallery"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>

                {/* Primary: Camera */}
                <button
                    onClick={handleCameraClick}
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-full p-4 shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Take Photo"
                >
                    {uploading ? (
                        <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-8.9l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>
            </div>



            {/* Edit Modal */}
            {isEditingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 p-6 rounded-xl w-full max-w-sm border border-gray-800 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Edit Event</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Event Name</label>
                                <input
                                    type="text"
                                    value={editEventName}
                                    onChange={(e) => setEditEventName(e.target.value)}
                                    className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500 min-h-[100px]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                                    <input
                                        type="datetime-local"
                                        value={editStartDate}
                                        onChange={(e) => setEditStartDate(e.target.value)}
                                        className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">End Date</label>
                                    <input
                                        type="datetime-local"
                                        value={editEndDate}
                                        onChange={(e) => setEditEndDate(e.target.value)}
                                        className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Visibility</label>
                                    <select
                                        value={editVisibility}
                                        onChange={(e) => setEditVisibility(e.target.value)}
                                        className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500 text-sm"
                                    >
                                        <option value="public">Public</option>
                                        <option value="unlisted">Unlisted</option>
                                        <option value="private">Private</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Join Mode</label>
                                    <select
                                        value={editJoinMode}
                                        onChange={(e) => setEditJoinMode(e.target.value)}
                                        className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500 text-sm"
                                    >
                                        <option value="open">Open</option>
                                        <option value="pin">PIN Code</option>
                                        <option value="invite_only">Invite Only</option>
                                    </select>
                                </div>
                            </div>

                            {/* Visibility Alerts & Helpers */}
                            {editVisibility === 'public' && (
                                <div className="flex items-start gap-2 bg-orange-900/30 border border-orange-900/50 p-3 rounded-lg text-xs text-orange-200 mt-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    <span>Warning: This event will be visible to anyone visiting the site.</span>
                                </div>
                            )}

                            {editVisibility === 'private' && (
                                <div className="flex items-start gap-2 bg-blue-900/30 border border-blue-900/50 p-3 rounded-lg text-xs text-blue-200 mt-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                    <span>Guests will need the Event Code to enter.</span>
                                </div>
                            )}

                            {editVisibility === 'unlisted' && (
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        enqueueSnackbar("Link copied to clipboard", { variant: 'success' });
                                    }}
                                    className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white text-sm py-2 px-4 rounded border border-gray-700 transition flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy Event URL
                                </button>
                            )}

                            {editJoinMode === 'pin' && (
                                <div className="animate-fade-in mt-4">
                                    <label className="text-xs text-gray-400 block mb-1">PIN Code</label>
                                    <input
                                        type="text"
                                        value={editPin}
                                        onChange={(e) => setEditPin(e.target.value)}
                                        className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500 text-sm tracking-widest"
                                        placeholder="1234"
                                    />
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-800">
                                <h3 className="text-red-500 text-xs font-bold uppercase mb-2">Danger Zone</h3>
                                <button
                                    onClick={handleDeleteEvent}
                                    className="w-full border border-red-900 text-red-500 hover:bg-red-900/20 text-sm py-2 rounded transition"
                                >
                                    Delete Event
                                </button>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-800">
                                <button
                                    onClick={() => setIsEditingEvent(false)}
                                    className="text-gray-400 hover:text-white px-4 py-2"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateEvent}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {isSharing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl relative">
                        <button
                            onClick={() => setIsSharing(false)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 rounded-full p-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="flex flex-col items-center gap-6 pt-4 pb-2">
                            <h2 className="text-xl font-bold text-gray-900 text-center">Share Event</h2>

                            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                                <QRCode
                                    value={window.location.href}
                                    size={200}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>

                            <div className="w-full space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center block">Event URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={window.location.href}
                                        className="w-full bg-gray-100 text-gray-600 text-sm p-3 rounded-lg border border-gray-200 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.href);
                                            enqueueSnackbar("Link copied!", { variant: 'success' });
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg flex items-center justify-center flex-shrink-0 transition"
                                        title="Copy Link"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="text-sm text-gray-500">Scan to join {event.name}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
