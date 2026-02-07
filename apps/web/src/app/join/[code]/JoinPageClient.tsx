"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';

export default function JoinPage({ code: propCode }: { code?: string }) {
    const params = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const code = propCode || (params.code as string);

    const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [authError, setAuthError] = useState('');
    const authenticating = useRef(false);

    const checkExistingAuth = async () => {
        if (pb.authStore.isValid) {
            try {
                console.log("Verifying existing session...");
                await pb.collection('users').authRefresh();

                if (!pb.authStore.model) {
                    throw new Error("Token valid but user model missing");
                }

                console.log("Existing session valid. User:", pb.authStore.model.id);
                setAuthStatus('success');
            } catch (err) {
                console.warn("Existing session invalid or expired.", err);
                pb.authStore.clear();
                setAuthStatus('idle');
            }
        }
    };

    const createGuestSession = async () => {
        if (authStatus === 'loading' || authenticating.current) return false;

        authenticating.current = true;
        setAuthStatus('loading');
        setAuthError('');
        console.log("Starting anonymous auth...");

        try {
            const randomId = Math.random().toString(36).substring(7);
            const email = `guest_${randomId}@eventpix.local`;
            const password = `pass_${randomId}`;

            await pb.collection('users').create({
                email,
                password,
                passwordConfirm: password,
                name: "Guest " + randomId
            });
            await pb.collection('users').authWithPassword(email, password);
            console.log("Auth successful:", pb.authStore.model?.id);
            setAuthStatus('success');
            return true;
        } catch (err: any) {
            console.error("Auth failed:", err);
            setAuthStatus('error');
            setAuthError("Failed to create guest session. Please try again.");
            authenticating.current = false;
            return false;
        }
    };

    useEffect(() => {
        const init = async () => {
            // Check auth ONCE on mount
            await checkExistingAuth();

            try {
                // Find event by code (case-insensitive by convention)
                const normalizedCode = code.toUpperCase();
                const records = await pb.collection('events').getList(1, 1, {
                    filter: `code = "${normalizedCode}"`,
                });

                if (records.items.length > 0) {
                    setEvent(records.items[0]);
                } else {
                    setError('Event not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load event');
            } finally {
                setLoading(false);
            }
        };

        if (code) init();
    }, [code]);

    // Auto-redirect if already authenticated and no PIN required
    useEffect(() => {
        if (authStatus === 'success' && event && event.join_mode !== 'pin') {
            console.log("Already authenticated, redirecting to event...");
            router.push(`/event/${event.id}`);
        }
    }, [authStatus, event, router]);

    const [authProviders, setAuthProviders] = useState<any[]>([]);

    useEffect(() => {
        pb.collection('users').listAuthMethods().then((methods) => {
            const providers = (methods as any).authProviders || (methods as any).oauth2?.providers || [];
            setAuthProviders(providers);
        }).catch(err => console.error("Failed to fetch auth providers", err));
    }, []);

    useEffect(() => {
        if (event?.join_mode === 'pin') {
            const timer = setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [event]);

    const [digits, setDigits] = useState(['', '', '', '']);
    const pin = digits.join('');
    const inputRefs = useRef<HTMLInputElement[]>([]);
    const [pinError, setPinError] = useState('');
    const [verifying, setVerifying] = useState(false);

    const handleDigitChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newDigits = [...digits];
        newDigits[index] = value;
        setDigits(newDigits);
        setPinError('');

        // Auto-advance
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit if last digit filled
        if (index === 3 && value) {
            // Optional: trigger submit or just let them click button
            // To be safe, let them click or hit enter, but focus stays
        }
    };

    const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter') {
            handleJoin();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 4).split('');
        if (pastedData.every(char => /^\d$/.test(char))) {
            const newDigits = [...digits];
            pastedData.forEach((char, i) => {
                if (i < 4) newDigits[i] = char;
            });
            setDigits(newDigits);
            if (pastedData.length === 4) {
                inputRefs.current[3]?.focus();
            } else {
                inputRefs.current[pastedData.length]?.focus();
            }
        }
    };

    const handleOAuthLogin = async (providerName: string) => {
        setLoading(true);
        try {
            let authData;

            // 1. Authenticate or Link
            if (pb.authStore.isValid && pb.authStore.model) {
                try {
                    console.log("Attempting to link social account to guest session...");
                    // Cast to any to bypass TS error if definition is missing
                    authData = await (pb.collection('users') as any).linkWithOAuth2({ provider: providerName });
                    console.log("Account linked successfully.");
                } catch (linkErr) {
                    console.warn("Link failed (likely account exists), falling back to switch.", linkErr);
                    authData = await pb.collection('users').authWithOAuth2({ provider: providerName });
                }
            } else {
                authData = await pb.collection('users').authWithOAuth2({ provider: providerName });
            }

            // 2. Sync Profile Data (Name, Avatar, Email)
            const meta = authData?.meta;
            const user = pb.authStore.model;

            console.log("Profile Sync Debug:", { meta, user });

            if (meta && user) {
                // A. Prepare Name & Avatar update
                const formData = new FormData();
                let hasUpdates = false;

                // Name
                if (meta.name && meta.name !== user.name) {
                    console.log(`Syncing name: ${user.name} -> ${meta.name}`);
                    formData.append('name', meta.name);
                    hasUpdates = true;
                }

                // Avatar (only if we have a URL)
                if (meta.avatarUrl) {
                    console.log("Found avatar URL:", meta.avatarUrl);
                    try {
                        const res = await fetch(meta.avatarUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            console.log("Avatar blob fetched:", blob.size, blob.type);
                            formData.append('avatar', blob);
                            hasUpdates = true;
                        } else {
                            console.warn("Avatar fetch returned status:", res.status);
                        }
                    } catch (fetchErr) {
                        console.warn("Failed to fetch avatar from social provider (likely CORS)", fetchErr);
                    }
                }

                if (hasUpdates) {
                    try {
                        console.log("Sending Profile Update (Name/Avatar)...");
                        await pb.collection('users').update(user.id, formData);
                        console.log("Profile Update Success");
                    } catch (updateErr) {
                        console.error("Failed to update profile", updateErr);
                    }
                }

                // B. Sync Email (Separate step to handle uniqueness constraints safely)
                if (meta.email && meta.email !== user.email) {
                    try {
                        console.log(`Syncing email: ${user.email} -> ${meta.email}`);
                        await pb.collection('users').update(user.id, {
                            email: meta.email,
                            emailVisibility: true,
                        });
                        console.log("Email Update Success");
                    } catch (emailErr) {
                        console.warn("Could not sync email (probably already in use by another account)", emailErr);
                    }
                }
            }

            // Auth successful, now join
            if (event) {
                if (event.join_mode !== 'pin') {
                    // Track join (open/invite modes that auto-succeed via OAuth)
                    const joinedEvents = JSON.parse(localStorage.getItem('joined_events') || '[]');
                    if (!joinedEvents.includes(event.id)) {
                        joinedEvents.push(event.id);
                        localStorage.setItem('joined_events', JSON.stringify(joinedEvents));
                    }
                    router.push(`/event/${event.id}`);
                }
            }
        } catch (err) {
            console.error("OAuth failed", err);
            // set error?
        } finally {
            setLoading(false);
        }
    };



    const handleJoin = async () => {
        if (!event) return;

        // Ensure we are authenticated
        if (authStatus !== 'success' && !pb.authStore.isValid) {
            // Try one last time? Or showing error is better.
            setAuthError("You must be signed in to join.");
            return;
        }

        // If PIN is required
        if (event.join_mode === 'pin') {
            if (!pin.trim()) {
                setPinError('Please enter the PIN');
                return;
            }
            setVerifying(true);
            setPinError('');

            // Securely verify PIN by trying to fetch the specific record with matching code AND pin
            // If we find it, the PIN is correct. We don't want to fetch valid PIN to client.
            try {
                const records = await pb.collection('events').getList(1, 1, {
                    filter: `code = "${event.code}" && pin = "${pin}"`
                });

                if (records.items.length > 0) {
                    // Success!
                    // Track join
                    const joinedEvents = JSON.parse(localStorage.getItem('joined_events') || '[]');
                    if (!joinedEvents.includes(event.id)) {
                        joinedEvents.push(event.id);
                        localStorage.setItem('joined_events', JSON.stringify(joinedEvents));
                    }
                    router.push(`/event/${event.id}`);
                } else {
                    setPinError('Incorrect PIN');
                }
            } catch (err) {
                console.error("PIN verification error", err);
                setPinError('Verification failed');
            } finally {
                setVerifying(false);
            }
        } else {
            // Open event
            // Track join
            const joinedEvents = JSON.parse(localStorage.getItem('joined_events') || '[]');
            if (!joinedEvents.includes(event.id)) {
                joinedEvents.push(event.id);
                localStorage.setItem('joined_events', JSON.stringify(joinedEvents));
            }
            router.push(`/event/${event.id}`);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Loading...</div>;
    if (error) return <div className="flex h-screen items-center justify-center bg-gray-950 text-red-500">{error}</div>;

    return (
        <div className="flex h-screen flex-col items-center justify-center bg-gray-950 text-white p-4">
            <h1 className="text-3xl font-bold mb-2 text-center">{event.name}</h1>
            <p className="text-gray-400 mb-8">Event Code: <span className="text-white font-mono">{event.code}</span></p>

            <div className="w-full max-w-sm space-y-4">

                {event.join_mode === 'pin' && (
                    <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 animate-fade-in">
                        <label className="text-xs text-gray-400 block mb-3 uppercase tracking-wider text-center">Event PIN Required</label>
                        <div className="flex justify-center gap-3 mb-2">
                            {digits.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => {
                                        if (el) inputRefs.current[index] = el;
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    className="w-12 h-14 text-center text-2xl font-bold bg-black border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                                    value={digit}
                                    onChange={(e) => handleDigitChange(index, e.target.value)}
                                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                                    onPaste={handlePaste}
                                />
                            ))}
                        </div>
                        {pinError && <p className="text-red-500 text-sm mt-2 text-center">{pinError}</p>}
                    </div>
                )}

                {authStatus === 'error' && (
                    <div className="bg-red-900/20 border border-red-900 p-3 rounded-lg text-red-500 text-sm mb-4">
                        <p className="mb-2">{authError}</p>
                        <button
                            onClick={createGuestSession}
                            className="text-white underline text-xs font-bold"
                        >
                            Retry Connection
                        </button>
                    </div>
                )}

                <button
                    onClick={async () => {
                        if (authStatus === 'success') {
                            handleJoin();
                        } else {
                            const success = await createGuestSession();
                            if (success) {
                                // Small delay to ensure state update propagates if needed, 
                                // though we just awaited it. handleJoin checks authStore.
                                handleJoin();
                            }
                        }
                    }}
                    disabled={verifying || authStatus === 'loading'}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {verifying ? 'Verifying...' : (authStatus === 'loading' ? 'Connecting...' : (authStatus === 'success' ? 'Join Event' : 'Continue as Guest'))}
                </button>

                {(authProviders || []).length > 0 && event.join_mode !== 'pin' && (
                    <div className="space-y-3 pt-2">
                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-gray-800"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase">Or</span>
                            <div className="flex-grow border-t border-gray-800"></div>
                        </div>
                        {authProviders.map((p) => {
                            const isGoogle = p.name === 'google';
                            const isApple = p.name === 'apple';

                            let buttonClass = "w-full font-bold py-3 px-8 rounded-lg transition flex items-center justify-center gap-2 ";
                            if (isGoogle) {
                                buttonClass += "bg-white text-gray-900 hover:bg-gray-100";
                            } else if (isApple) {
                                buttonClass += "bg-black text-white border border-gray-700 hover:bg-gray-900";
                            } else {
                                buttonClass += "bg-gray-800 text-white hover:bg-gray-700";
                            }

                            return (
                                <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => handleOAuthLogin(p.name)}
                                    className={buttonClass}
                                >
                                    {isGoogle && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                    )}
                                    {isApple && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-1.64 3.57-1.14 3.16.89 5.37 8.35 2.15 13.37zM12.93 2.56C13.68 1.49 15.68.61 16.92 1c.14 1.83-1.66 3.79-3.4 3.91-.95.03-3.23-1.07-2.3-2.35z" /></svg>
                                    )}
                                    {!isGoogle && !isApple && (
                                        // Generic icon
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                    )}
                                    Continue with {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                                </button>
                            );
                        })}
                    </div>
                )}

                <p className="text-center text-xs text-gray-500 mt-4">
                    By joining, you agree to share photos with the event host.
                </p>
            </div>
        </div>
    );
}
