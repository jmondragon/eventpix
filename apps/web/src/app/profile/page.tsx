"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import { pb, getUser, isAuthenticated } from '@/lib/pocketbase';

export default function ProfilePage() {
    const router = useRouter();
    const { enqueueSnackbar } = useSnackbar();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [newName, setNewName] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Auth Providers
    const [authProviders, setAuthProviders] = useState<any[]>([]);
    const [linkedProviders, setLinkedProviders] = useState<any[]>([]);
    const [linking, setLinking] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/');
            return;
        }
        const currentUser = getUser();
        if (!currentUser) return; // Should be handled by isAuthenticated check above, but satisfies TS.

        setUser(currentUser);
        setNewName(currentUser.name || '');
        setLoading(false);

        // Fetch Server Auth Methods
        pb.collection('users').listAuthMethods().then((methods) => {
            const providers = (methods as any).authProviders || (methods as any).oauth2?.providers || [];
            setAuthProviders(providers);
        }).catch(err => console.error("Failed to fetch auth providers", err));

        // Fetch User's Linked Accounts
        pb.collection('users').listExternalAuths(currentUser.id)
            .then((auths) => {
                setLinkedProviders(auths);
            })
            .catch(err => {
                console.log("Could not fetch linked accounts (likely permission issue or not supported)", err);
            });

    }, [router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', newName);
            if (avatarFile) {
                formData.append('avatar', avatarFile);
            }

            const updated = await pb.collection('users').update(user.id, formData);
            setUser(updated);
            setAvatarFile(null); // Reset file input
            // Keep previewUrl if we want, or rely on updated user.avatar. 
            // Better to rely on updated user.avatar, but URL might take a split second to propagate if using CDN? 
            // PB returns the updated record immediately.
            setPreviewUrl(null);

            enqueueSnackbar("Profile updated successfully", { variant: 'success' });
        } catch (err) {
            console.error(err);
            enqueueSnackbar("Failed to update profile", { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleLinkAccount = async (providerName: string) => {
        setLinking(true);
        try {
            // Explicitly link
            // @ts-ignore
            await pb.collection('users').linkWithOAuth2({ provider: providerName });
            enqueueSnackbar(`Successfully linked ${providerName}`, { variant: 'success' });

            // Refresh linked list
            const auths = await pb.collection('users').listExternalAuths(user.id);
            setLinkedProviders(auths);

            // Refresh user details (e.g. avatar might update?)
            const refreshed = await pb.collection('users').getOne(user.id);
            setUser(refreshed);

        } catch (err: any) {
            console.error("Link failed", err);
            // If error suggests it's already linked to THIS user, just refresh.
            // If linked to ANOTHER user, show error.
            enqueueSnackbar("Failed to link account. It might be in use by another user.", { variant: 'error' });
        } finally {
            setLinking(false);
        }
    };

    const handleLogout = () => {
        pb.authStore.clear();
        router.push('/');
    };

    const handleUnlink = async (providerName: string) => {
        // Find ID
        const link = linkedProviders.find(p => p.provider === providerName);
        if (!link) return;

        if (!confirm(`Are you sure you want to disconnect ${providerName}?`)) return;

        try {
            await pb.collection('users').unlinkExternalAuth(user.id, providerName);
            enqueueSnackbar(`Disconnected ${providerName}`, { variant: 'success' });
            // Refresh linked list
            const auths = await pb.collection('users').listExternalAuths(user.id);
            setLinkedProviders(auths);
        } catch (err) {
            console.error(err);
            enqueueSnackbar(`Failed to disconnect ${providerName}`, { variant: 'error' });
        }
    }

    if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;

    const isGuest = user?.email?.startsWith('guest_');

    return (
        <div className="min-h-screen bg-gray-950 text-white pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 p-4 flex items-center gap-4">
                <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold">Your Profile</h1>
            </header>

            <main className="p-4 max-w-md mx-auto space-y-8 mt-4">

                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold shadow-2xl border-4 border-gray-900 overflow-hidden">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : user?.avatar ? (
                                <img
                                    src={pb.files.getURL(user, user.avatar)}
                                    alt={user.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>{(user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()}</span>
                            )}
                        </div>

                        {/* Edit Overlay */}
                        <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <span className="text-white text-xs font-bold">CHANGE</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>

                    <div className="text-center">
                        <p className="text-gray-400 text-sm">{user?.email}</p>
                        {isGuest && <span className="inline-block mt-1 px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] uppercase font-bold rounded">Guest Account</span>}
                    </div>
                </div>

                {/* Edit Profile Form */}
                <form onSubmit={handleSaveProfile} className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg space-y-4">
                    <h2 className="text-lg font-bold">Profile Details</h2>
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-bold tracking-widest block mb-2">Display Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-gray-700"
                            placeholder="Your Name"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>

                {/* Account Security / Linked Accounts */}
                {authProviders.length > 0 && (
                    <div className={`p-6 rounded-xl border shadow-lg space-y-4 relative overflow-hidden ${isGuest ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800'}`}>

                        {isGuest && (
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}

                        <div className="relative z-10">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {isGuest ? (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Secure your Account
                                    </>
                                ) : (
                                    <span>Linked Accounts</span>
                                )}
                            </h2>
                            <p className="text-gray-400 text-sm mt-1 mb-4">
                                {isGuest
                                    ? "Don't lose your photos! Link a social account to access your events from any device."
                                    : "Manage your connected social accounts."}
                            </p>

                            <div className="space-y-3">
                                {authProviders.map((p) => {
                                    const isGoogle = p.name === 'google';
                                    const isLinked = linkedProviders.some(lp => lp.provider === p.name);

                                    return (
                                        <div key={p.name} className="flex gap-2">
                                            {isLinked ? (
                                                <div className="w-full bg-gray-800 text-green-400 font-bold py-3 px-4 rounded-lg flex items-center justify-between border border-green-900/30">
                                                    <span className="flex items-center gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                        {p.name.charAt(0).toUpperCase() + p.name.slice(1)} Connected
                                                    </span>
                                                    {/* Optional: Disconnect button if not the only method */}
                                                    {/* For now, maybe just show status to avoid locking them out if they have no password */}
                                                    {/* <button onClick={() => handleUnlink(p.name)} className="text-xs text-gray-500 hover:text-red-400">Disconnect</button> */}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleLinkAccount(p.name)}
                                                    disabled={linking}
                                                    className={`w-full font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 ${isGoogle ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-black text-white py-3 border border-gray-600"
                                                        }`}
                                                >
                                                    {isGoogle ? (
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                        </svg>
                                                    ) : null}
                                                    {isGuest ? 'Continue with' : 'Link'} {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Sign Out Button */}
                <button
                    onClick={handleLogout}
                    className="w-full bg-red-900/20 hover:bg-red-900/30 border border-red-900 text-red-500 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                </button>
            </main>
        </div>
    );
}
