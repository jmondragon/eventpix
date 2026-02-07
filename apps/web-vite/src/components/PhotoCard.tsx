import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface PhotoCardProps {
    photo: any;
    currentUserId?: string;
    eventOwnerId?: string;
}

export default function PhotoCard({ photo, currentUserId }: PhotoCardProps) {
    // Debug permissions
    // console.log(`Photo ${ photo.id }: `, { isOwner, isHost, currentUserId, photoOwner: photo.owner, eventOwner: eventOwnerId });
    // Detailed debug for long press issue
    // useEffect(() => {
    //    if (showControls) console.log("Controls Shown. Owner:", photo.owner, "Current:", currentUserId, "Match:", currentUserId === photo.owner);
    // }, [showControls]);

    const { enqueueSnackbar } = useSnackbar();
    const url = pb.files.getURL(photo, photo.file);
    const isOwner = currentUserId && currentUserId === photo.owner;
    const ownerName = isOwner ? 'You' : (photo.expand?.owner?.name || photo.expand?.owner?.email || 'Guest');

    const [isEditing, setIsEditing] = useState(false);
    const [caption, setCaption] = useState(photo.caption || ''); // Renamed from editCaption

    // Likes logic - Initializing state
    // const initialLikes = Array.isArray(photo.likes) ? photo.likes : (typeof photo.likes === 'string' && photo.likes.trim() !== '' ? [photo.likes] : []);
    // const [liked, setLiked] = useState(currentUserId ? initialLikes.includes(currentUserId) : false);
    // const [likesCount, setLikesCount] = useState(initialLikes.length);
    // Manage animation classes
    const [animationClass, setAnimationClass] = useState("animate-fade-in");
    const [highlight, setHighlight] = useState(false); // Keep highlight state for flash effect

    // Mobile Interaction State
    const [showControls, setShowControls] = useState(false);

    // Remove fade-in after it completes so it doesn't conflict with flash or restart
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimationClass("");
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Flash Highlight Logic
    useEffect(() => {
        // Only flash if the photo has been updated or likes/caption changed after initial mount
        // We can use a ref or a separate state to track if it's the first render.
        // For simplicity, let's assume `photo.updated` changes for updates.
        // If `photo.updated` is the same as `photo.created`, it's likely the initial load.
        if (photo.updated && photo.updated !== photo.created) {
            setHighlight(true);
            const timer = setTimeout(() => setHighlight(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [photo.updated, photo.likes, photo.caption]);

    // Handle Exit (if passed from parent, or we can assume if this component is about to unmount... 
    // actually standard React unmount happens instantly. We need the parent to delay unmount.)
    // For now, let's look for an `isExiting` prop or similar on the photo object if we were to add it.
    // But first, let's fix the re-fade-in issue which is the main annoyance.

    // Check permissions
    // Owner can Delete & Edit. Host can Delete.
    // const isOwner = currentUserId && currentUserId === photo.owner; // Now passed as prop
    // const isHost = currentUserId && currentUserId === eventOwnerId; // Removed
    const canDelete = isOwner; // Simplified, assuming host logic is handled upstream
    const canEdit = isOwner;

    // Debug permissions
    // console.log(`Photo ${ photo.id }: `, { isOwner, isHost, currentUserId, photoOwner: photo.owner, eventOwner: eventOwnerId });

    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = () => {
        setIsDeleting(true);
    };

    const confirmDelete = async () => {
        try {
            await pb.collection('photos').delete(photo.id);
            setIsDeleting(false);
        } catch (err) {
            console.error(err);
            enqueueSnackbar("Failed to delete photo", { variant: 'error' });
            setIsDeleting(false);
        }
    };

    const handleUpdateCaption = async () => { // Renamed from handleSaveCaption
        try {
            await pb.collection('photos').update(photo.id, { caption: caption }); // Using new caption state
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            enqueueSnackbar("Failed to update caption", { variant: 'error' });
        }
    };

    // Likes logic
    // PB can return a single string ID if only one relation exists, or array if multiple
    // Likes logic
    // PB can return: null, undefined, single string ID, or array of strings.
    // We must normalize to string[] to be safe.
    const rawLikes = photo.likes;
    let likes: string[] = [];

    if (Array.isArray(rawLikes)) {
        likes = rawLikes;
    } else if (typeof rawLikes === 'string' && rawLikes.trim() !== '') {
        likes = [rawLikes];
    }

    // Ensure uniqueness just in case
    likes = [...new Set(likes)];

    const isLiked = currentUserId ? likes.includes(currentUserId) : false;
    const likeCount = likes.length;

    const handleLike = async () => {
        if (!currentUserId) return;

        const newLikes = isLiked
            ? likes.filter((id: string) => id !== currentUserId)
            : [...likes, currentUserId];

        try {
            await pb.collection('photos').update(photo.id, { likes: newLikes });
        } catch (err) {
            console.error("Like failed", err);
        }
    };



    // Combining classes
    const finalClass = `mb-4 break-inside-avoid rounded-lg overflow-hidden shadow-lg bg-gray-800 relative group transition-all border border-transparent ${animationClass} ${highlight ? 'animate-flash' : ''} ${photo._isExiting ? 'animate-fade-out' : ''}`;

    return (
        <div className={finalClass}>
            <div
                className="relative w-full"
                onClick={() => {
                    // Simple toggle on tap/click
                    setShowControls(!showControls);
                    if (!showControls) {
                        setHighlight(true);
                        setTimeout(() => setHighlight(false), 200);
                    }
                }}
            >
                {/* Fallback to standard img to debug URL/NextConfig issues */}
                <img
                    src={url}
                    alt={photo.caption || "Event photo"}
                    className="w-full h-auto max-h-[500px] object-cover"
                    loading="lazy"
                />

                <div className={`absolute top-2 right-2 flex gap-2 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {canEdit && !isEditing && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                                setCaption(photo.caption || '');
                            }}
                            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm"
                            title="Edit Caption"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    )}
                    {canDelete && !isEditing && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete();
                            }}
                            className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm"
                            title="Delete Photo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Like Button (Always Visible) */}
                {!isEditing && (
                    <div className="absolute bottom-2 right-2">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors backdrop-blur-sm ${isLiked
                                ? "bg-red-500/90 text-white"
                                : "bg-black/40 text-white hover:bg-black/60"
                                } `}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLiked ? "fill-current" : ""} `} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            <span>{likeCount}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Always show footer now that we have timestamp/user info */}
            <div className="p-3">
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="w-full bg-gray-700 text-white text-sm rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            rows={2}
                            placeholder="Add a caption..."
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 text-xs">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateCaption}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {photo.caption && <p className="text-sm text-white mb-1">{photo.caption}</p>}
                        <div className="flex justify-between items-end text-xs text-gray-400">
                            <span>by {ownerName}</span>
                            <span>{dayjs(photo.created).fromNow()}</span>
                        </div>
                    </>
                )}
            </div>
            {/* Delete Confirmation Modal */}
            {isDeleting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 p-6 rounded-xl w-full max-w-sm border border-gray-800 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-2">Delete Photo?</h2>
                        <p className="text-gray-400 text-sm mb-6">Are you sure you want to delete this photo? This action cannot be undone.</p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleting(false)}
                                className="text-gray-400 hover:text-white px-4 py-2 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-lg shadow-red-900/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
