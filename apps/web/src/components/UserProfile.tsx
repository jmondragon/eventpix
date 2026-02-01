"use client";

import { useState, useRef, useEffect } from 'react';
import { pb, getUser } from '@/lib/pocketbase';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';

export default function UserProfile() {
    const router = useRouter();
    const { enqueueSnackbar } = useSnackbar();
    const [user, setUser] = useState<any>(getUser());
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(user?.name || '');
    const menuRef = useRef<HTMLDivElement>(null);

    // Refresh user on mount
    useEffect(() => {
        setUser(getUser());
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const [loading, setLoading] = useState(false);

    const handleLogout = () => {
        pb.authStore.clear();
        router.push('/');
    };

    const handleSave = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            const updated = await pb.collection('users').update(user.id, {
                name: newName
            });
            setUser(updated);
            setIsOpen(false);
            setIsEditing(false);
            enqueueSnackbar("Profile updated", { variant: 'success' });
        } catch (err) {
            console.error(err);
            enqueueSnackbar("Failed to update name", { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    // Get initials
    const getInitials = () => {
        const name = user.name || user.email || '?';
        const parts = name.split(' ').filter((p: string) => p.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95 border border-white/10 overflow-hidden"
                title={user.name || user.email}
            >
                {user.avatar ? (
                    <img
                        src={pb.files.getUrl(user, user.avatar)}
                        alt={user.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    getInitials()
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in origin-top-right">
                    <div className="p-4 border-b border-gray-800">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Signed in as</p>
                        <p className="text-white font-medium truncate">{user.email}</p>
                    </div>

                    <div className="p-2">
                        {isEditing ? (
                            <div className="p-2 space-y-2">
                                <label className="text-xs text-gray-400">Display Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-xs py-1.5 rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setNewName(user.name || '');
                                    setIsEditing(true);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white text-sm transition flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Change Name
                            </button>
                        )}

                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-900/20 text-red-400 hover:text-red-300 text-sm transition mt-1 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
