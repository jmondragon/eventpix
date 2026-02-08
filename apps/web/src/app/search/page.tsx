"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';

export default function SearchPage() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Debounce search or just fetch on effect
    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            try {
                // Base filter: Always public
                let filter = 'visibility = "public"';
                let sort = 'start_date'; // Ascending by default (upcoming first)
                let perPage = 50;

                // If query, add name filter
                if (query.trim()) {
                    filter += ` && name ~ "${query.trim()}"`;
                    sort = '-start_date'; // Show newest/recent first when searching
                } else {
                    // Default view: Upcoming Public Events
                    // Filter for future events
                    filter += ` && start_date >= "${new Date().toISOString()}"`;
                    // Limit to next 5
                    perPage = 5;
                }

                const result = await pb.collection('events').getList(1, perPage, {
                    filter: filter,
                    sort: sort, // ASC for upcoming
                });

                setEvents(result.items);
            } catch (err) {
                console.error("Error fetching public events:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchEvents();
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [query]);

    return (
        <div className="min-h-screen bg-black text-white p-4">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8 sticky top-0 bg-black/80 backdrop-blur-md z-10 py-4 -mx-4 px-4 border-b border-gray-800">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold">Public Events</h1>
            </header>

            {/* Search Bar */}
            <div className="mb-8 relative max-w-md mx-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    placeholder="Find public event name..."
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-lg placeholder-gray-600"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
            </div>

            {/* Results */}
            <div className="max-w-md mx-auto space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500 py-12">Loading...</div>
                ) : events.length > 0 ? (
                    events.map(event => (
                        <div
                            key={event.id}
                            onClick={() => router.push(`/join/${event.code}`)}
                            className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg p-4 cursor-pointer transition text-left group flex justify-between items-center"
                        >
                            <div>
                                <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">{event.name}</h3>
                                <div className="text-gray-500 text-sm mt-1">
                                    {new Date(event.start_date || event.date || event.created).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="bg-gray-800 group-hover:bg-blue-600/20 p-2 rounded-full transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-500 py-12">
                        {query ? 'No events found matching your search.' : 'No upcoming public events found.'}
                    </div>
                )}
            </div>
        </div>
    );
}
