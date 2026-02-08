"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import { pb, isAuthenticated, getUser } from '@/lib/pocketbase';

import UserProfile from '@/components/UserProfile';
import { InstallPWAButton } from '@/components/InstallPWAButton';

export default function Home() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  // View State
  const [mode, setMode] = useState<'guest' | 'host'>('guest');
  const [subMode, setSubMode] = useState<'login' | 'dashboard' | 'create'>('login');

  // Data State
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [publicEvents, setPublicEvents] = useState<any[]>([]);
  const [authProviders, setAuthProviders] = useState<any[]>([]);
  const [passwordEnabled, setPasswordEnabled] = useState(true);

  // New Event State
  const [newEventName, setNewEventName] = useState('');
  const [newEventCode, setNewEventCode] = useState('');
  const [newVisibility, setNewVisibility] = useState('private');
  const [newJoinMode, setNewJoinMode] = useState('open');
  const [newPin, setNewPin] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reactive User State
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Initial fetch on mount (client-side only)
    setCurrentUser(getUser());

    // Subscribe to changes
    return pb.authStore.onChange(() => {
      setCurrentUser(getUser());
    });
  }, []);

  // Initial Auth Check and Providers
  useEffect(() => {
    // Check Auth - if logged in as regular user, default to dashboard?
    // Or just stay on guest mode?
    if (isAuthenticated()) {
      const user = getUser();
      // Only auto-switch to dashboard if we are NOT a guest account
      if (user && user.email && !user.email.startsWith('guest_')) {
        setMode('host');
        setSubMode('dashboard');
        fetchMyEvents();
      }
    }

    // Fetch Auth Providers
    pb.collection('users').listAuthMethods().then((methods) => {
      const providers = (methods as any).authProviders || (methods as any).oauth2?.providers || [];
      const passEnabled = (methods as any).password?.enabled ?? true;
      setAuthProviders(providers);
      setPasswordEnabled(passEnabled);
    }).catch(err => {
      console.error("Auth Methods Error:", err);
    });

    // Fetch Public Events
    pb.collection('events').getList(1, 10, {
      filter: 'visibility = "public"',
      sort: '-created'
    }).then(res => {
      setPublicEvents(res.items);
    }).catch(err => console.error("Failed to fetch public events", err));
  }, []);

  // ... (fetchMyEvents and handlers remain the same) ...
  // But wait, I need to include them in the replace call if I am replacing the top part of the file.
  // The Instruction says: "Add UserProfile to header...".
  // I will use `replace_file_content` to swap the imports and the top part of the component logic.
  // Then another call to swap the JSX header.

  // Let's do imports first + component start.


  const fetchMyEvents = async () => {
    try {
      const user = getUser();
      if (!user) return;

      // We need to fetch both owned events AND joined events
      // Fetch user details to get latest joined_events list
      const userRecord = await pb.collection('users').getOne(user.id);
      const joinedIds = (userRecord.joined_events as string[]) || [];

      let filter = `owner = "${user.id}"`;
      if (joinedIds.length > 0) {
        const joinedFilter = joinedIds.map(id => `id = "${id}"`).join(' || ');
        filter = `(${filter}) || (${joinedFilter})`;
      }

      const records = await pb.collection('events').getList(1, 50, {
        filter: filter,
        sort: '-created'
      });
      setMyEvents(records.items);
    } catch (err: any) {
      console.error("Failed to fetch events", err);
      if (err.data) console.error("PB Error Data:", err.data);
      // alert("Fetch failed: " + JSON.stringify(err.data));
    }
  };

  const transferGuestData = async (userId: string) => {
    try {
      const localJoinedEvents = JSON.parse(localStorage.getItem('joined_events') || '[]');
      if (localJoinedEvents.length === 0) return;

      const user = await pb.collection('users').getOne(userId);
      // specific type cast or any for flexibility
      const serverJoinedEvents = (user as any).joined_events || [];

      // Merge unique
      const newJoinedEvents = Array.from(new Set([...serverJoinedEvents, ...localJoinedEvents]));

      // Only update if there's a difference
      if (newJoinedEvents.length > serverJoinedEvents.length) {
        await pb.collection('users').update(userId, {
          joined_events: newJoinedEvents
        });
        console.log("Transferred guest events:", localJoinedEvents);
        enqueueSnackbar("Synced guest events to your account.", { variant: 'success' });
      }

      // Optional: Clear local storage or keep it? Keeping it is safer for now.
    } catch (err) {
      console.error("Failed to transfer guest data", err);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      router.push(`/join/${code.toUpperCase()}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await pb.collection('users').authWithPassword(email, password);
      // Ensure we have correct user data
      const user = getUser();
      if (user) {
        await transferGuestData(user.id);
        setSubMode('dashboard');
        fetchMyEvents();
      }
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (providerName: string) => {
    setLoading(true);
    console.log("Starting OAuth login for:", providerName);
    try {
      const authData = await pb.collection('users').authWithOAuth2({
        provider: providerName
      });
      console.log("OAuth Success:", authData);

      const user = getUser();
      if (user) {
        await transferGuestData(user.id);
        setSubMode('dashboard');
        fetchMyEvents();
      }
    } catch (err: any) {
      console.error("OAuth failed full error:", err);
      console.error("Original error:", err?.originalError);
      setError(`Social login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const user = getUser();
      const record = await pb.collection('events').create({
        name: newEventName,
        code: newEventCode.toUpperCase(),
        owner: user?.id,
        date: new Date().toISOString(),
        approval_required: false,
        visibility: newVisibility,
        join_mode: newJoinMode,
        pin: newJoinMode === 'pin' ? newPin : '',
        description: newDescription,
        start_date: newStartDate ? new Date(newStartDate).toISOString() : '',
        end_date: newEndDate ? new Date(newEndDate).toISOString() : '',
      });
      // Refresh list and go back
      await fetchMyEvents();
      setSubMode('dashboard');
      setNewEventName('');
      setNewEventCode('');
      setNewPin('');
      setNewDescription('');
      setNewStartDate('');
      setNewEndDate('');
    } catch (err) {
      console.error(err);
      enqueueSnackbar("Failed to create event. Code might be taken.", { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setMode('guest');
    setSubMode('login');
    setEmail('');
    setPassword('');
    setMyEvents([]);
  };

  return (
    <div className="min-h-screen text-white">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        {/* Top Right Toggle */}
        <div className="absolute top-4 right-4 flex gap-4 items-center z-50">
          <InstallPWAButton />
          {currentUser ? (
            <UserProfile />
          ) : (
            <button
              onClick={() => {
                setMode('host');
                setSubMode('login');
              }}
              className="text-sm font-bold text-gray-300 hover:text-white transition"
            >
              Sign In
            </button>
          )}

        </div>

        <div className="fixed inset-0 -z-10">
          <img
            src="/backdrop-landscape.jpg"
            className="absolute inset-0 w-full h-full object-cover"
            alt="EventPix Background"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>

        <main className="flex flex-col items-center gap-8 text-center max-w-md w-full relative z-10">
          <img src="/logo-full.svg" alt="EventPix" className="h-24 w-auto mb-4" />

          <div className="relative flex p-1 bg-gray-900 rounded-full border border-gray-800 w-72 h-16">
            {/* Sliding Indicator */}
            <div
              className={`absolute top-1 bottom-1 transition-all duration-300 ease-out rounded-full z-0 w-[calc(50%-4px)] ${mode === 'guest' ? 'left-1 bg-blue-600' : 'left-[calc(50%+3px)] bg-purple-600'}`}
            />

            <button
              onClick={() => setMode('guest')}
              className={`flex-1 relative z-10 h-full text-base font-bold transition-colors duration-300 ${mode === 'guest' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              I'm a Guest
            </button>
            <button
              onClick={() => setMode('host')}
              className={`flex-1 relative z-10 h-full text-base font-bold transition-colors duration-300 ${mode === 'host' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              I'm a Host
            </button>
          </div>

          {mode === 'guest' ? (
            <>
              <p className="text-gray-400">Join an event to add photos.</p>
              <form onSubmit={handleJoin} className="w-full space-y-4">
                <input
                  type="text"
                  placeholder="Enter Event Code (e.g. WEDDING)"
                  className="w-full p-3 rounded-lg bg-gray-900 border border-gray-800 text-center text-lg uppercase tracking-widest focus:ring-2 focus:ring-blue-600 focus:outline-none placeholder-gray-600"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold tracking-wider rounded-lg shadow-lg active:scale-[0.97]"
                >
                  Join Event
                </button>
              </form>

              <div className="w-full mt-12 mb-8">
                <div className="relative flex py-2 items-center mb-6">
                  <div className="flex-grow border-t border-gray-800"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase">Or Browse Public Events</span>
                  <div className="flex-grow border-t border-gray-800"></div>
                </div>

                <div className="grid gap-4 w-full">
                  {publicEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => router.push(`/join/${event.code}`)}
                      className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg p-4 cursor-pointer transition text-left group"
                    >
                      <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">{event.name}</h3>
                      <div className="flex justify-between mt-2 text-sm text-gray-500">
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          Public
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  ))}
                  {publicEvents.length === 0 && !loading && (
                    <div className="text-gray-600 text-sm">No public events found.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // HOST MODE
            <div className="w-full">
              {subMode === 'login' && !passwordEnabled && authProviders.length === 0 && (
                <div className="text-center p-4 bg-gray-900 rounded">
                  <p>No login methods available.</p>
                </div>
              )}

              {subMode === 'login' && (
                <div className="w-full">
                  <p className="text-gray-400 mb-6">Create an event and invite guests.</p>
                  {/* Social Login Only Container if Password Disabled, or Mix */}

                  {passwordEnabled && (
                    <form onSubmit={handleLogin} className="space-y-4 text-left">
                      <h2 className="text-xl font-semibold text-center mb-6 text-white/90">Host Login</h2>
                      {error && <div className="text-red-500 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/40">{error}</div>}
                      <div>
                        <label className="text-xs text-gray-400 block mb-1 ml-1 uppercase tracking-wider font-bold">Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all placeholder:text-gray-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1 ml-1 uppercase tracking-wider font-bold">Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all placeholder:text-gray-600"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold tracking-wider rounded-lg shadow-lg mt-6 disabled:opacity-50 active:scale-[0.97]"
                      >
                        {loading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  )}

                  {/* Social Login */}
                  {(authProviders || []).length > 0 && (
                    <div className={passwordEnabled ? "mt-8" : "mt-0"}>
                      {passwordEnabled && (
                        <div className="relative flex py-4 items-center">
                          <div className="flex-grow border-t border-gray-800/50"></div>
                          <span className="flex-shrink-0 mx-4 text-gray-500 text-[10px] uppercase font-bold tracking-widest">Secure Options</span>
                          <div className="flex-grow border-t border-gray-800/50"></div>
                        </div>
                      )}

                      {!passwordEnabled && <h2 className="text-xl font-semibold text-center mb-6">Host Login</h2>}

                      <div className="grid grid-cols-1 gap-3">
                        {authProviders.map((p) => {
                          const isGoogle = p.name === 'google';
                          const isApple = p.name === 'apple';

                          let buttonClass = "w-full font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-3 active:scale-95 ";
                          if (isGoogle) {
                            buttonClass += "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/5";
                          } else if (isApple) {
                            buttonClass += "bg-black text-white border border-gray-800 hover:bg-gray-900";
                          } else {
                            buttonClass += "bg-gray-900 text-white border border-gray-800 hover:bg-gray-800";
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
                              Sign in with {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {subMode === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-gray-900/40 p-3 rounded-2xl border border-white/5">
                    <h2 className="text-xl font-bold ml-2">My Events</h2>
                    <button
                      onClick={() => setSubMode('create')}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg shadow-lg transition-all active:scale-95"
                    >
                      + New Event
                    </button>
                  </div>
                  <div className="space-y-3">
                    {myEvents.map(event => (
                      <div
                        key={event.id}
                        onClick={() => router.push(`/event/${event.id}`)}
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg p-4 flex justify-between items-center cursor-pointer transition-all group"
                      >
                        <div className="text-left">
                          <div className="font-bold text-lg group-hover:text-purple-400 transition-colors uppercase tracking-tight">{event.name}</div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">CODE: <span className="text-gray-300">{event.code}</span></div>
                        </div>
                        <div className="bg-purple-600/20 p-2 rounded-full group-hover:bg-purple-600/40 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                    {myEvents.length === 0 && (
                      <div className="text-gray-500 py-12 text-sm bg-gray-900/20 rounded-3xl border border-dashed border-gray-800 font-medium">You haven't created any events yet.</div>
                    )}
                  </div>
                </div>
              )}

              {subMode === 'create' && (
                <form onSubmit={handleCreateEvent} className="space-y-4 text-left bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <button
                      type="button"
                      onClick={() => setSubMode('dashboard')}
                      className="p-2 bg-gray-800/50 hover:bg-gray-800 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h2 className="text-2xl font-black tracking-tight uppercase">New Event</h2>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Event Name</label>
                      <input
                        type="text"
                        value={newEventName}
                        onChange={e => setNewEventName(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-bold placeholder:text-gray-600"
                        placeholder="e.g. Smith Wedding"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Event Code</label>
                      <input
                        type="text"
                        value={newEventCode}
                        onChange={e => setNewEventCode(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all uppercase tracking-[0.2em] font-bold placeholder:text-gray-600"
                        placeholder="WEDDING2025"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Description</label>
                      <textarea
                        value={newDescription}
                        onChange={e => setNewDescription(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium placeholder:text-gray-600 min-h-[100px]"
                        placeholder="Event details..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Start Date</label>
                        <input
                          type="datetime-local"
                          value={newStartDate}
                          onChange={e => setNewStartDate(e.target.value)}
                          className="w-full bg-black border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-white placeholder-gray-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">End Date</label>
                        <input
                          type="datetime-local"
                          value={newEndDate}
                          onChange={e => setNewEndDate(e.target.value)}
                          className="w-full bg-black border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium text-white placeholder-gray-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Visibility</label>
                        <select
                          value={newVisibility}
                          onChange={(e) => setNewVisibility(e.target.value)}
                          className="w-full bg-black border border-gray-800 text-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-bold appearance-none cursor-pointer"
                        >
                          <option value="public">🌍 Public</option>
                          <option value="unlisted">🔗 Unlisted</option>
                          <option value="private">🔒 Private</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Join Mode</label>
                        <select
                          value={newJoinMode}
                          onChange={(e) => setNewJoinMode(e.target.value)}
                          className="w-full bg-black border border-gray-800 text-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-bold appearance-none cursor-pointer"
                        >
                          <option value="open">✨ Open</option>
                          <option value="pin">🔢 PIN Code</option>
                          <option value="invite_only">📩 Invite</option>
                        </select>
                      </div>
                    </div>

                    {newJoinMode === 'pin' && (
                      <div className="animate-fade-in">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2 ml-1">Secure PIN</label>
                        <input
                          type="text"
                          value={newPin}
                          onChange={e => setNewPin(e.target.value)}
                          className="w-full bg-black border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all tracking-[0.5em] font-bold text-center"
                          placeholder="1234"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full h-14 bg-white text-black text-lg font-bold uppercase tracking-widest rounded-lg shadow-lg mt-8 disabled:opacity-50 active:scale-[0.97] transition-all"
                  >
                    {creating ? 'Creating...' : 'Launch Event'}
                  </button>
                </form>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
