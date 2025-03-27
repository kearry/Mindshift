'use client'; // Needs hooks for data fetching and params

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Topic, User, Debate } from '@prisma/client'; // Import base types

// Define types for the expected profile data structure from API
// Based on the select statements in the API route
interface ProfileUserData extends Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl' | 'bio' | 'createdAt' | 'totalPoints' | 'rank'> { }
interface ProfileDebateData extends Pick<Debate, 'debateId' | 'status' | 'pointsEarned' | 'createdAt' | 'completedAt'> {
    topic: Pick<Topic, 'topicId' | 'name'>;
}
interface ProfileData {
    user: ProfileUserData;
    debates: ProfileDebateData[];
}

export default function UserProfilePage() {
    const params = useParams();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const userIdStr = Array.isArray(params.userId) ? params.userId[0] : params.userId;
    const userId = parseInt(userIdStr ?? '', 10);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            setProfile(null);

            if (isNaN(userId)) {
                setError("Invalid User ID format");
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/users/${userId}/profile`);
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch { }
                    if (response.status === 404) {
                        // Use Next.js notFound for standard 404 page
                        notFound();
                        return; // Stop execution
                    }
                    throw new Error(errorMsg);
                }
                const data: ProfileData = await response.json();
                setProfile(data);
            } catch (err: unknown) {
                console.error("Fetch profile error:", err);
                setError(err instanceof Error ? err.message : "Failed to load profile");
            } finally {
                setLoading(false);
            }
        };

        if (userIdStr) {
            fetchProfile();
        } else {
            setError("User ID missing");
            setLoading(false);
        }
    }, [userIdStr, userId]); // Add userId to dependency array

    if (loading) return <p className="text-center mt-10">Loading profile...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    // If !profile and no error/loading, notFound() should have been called from fetch
    if (!profile) return <p className="text-center mt-10">Profile not found.</p>;

    const { user, debates } = profile;

    return (
        <div className="container mx-auto p-4">
            {/* User Info Section */}
            <div className="mb-8 p-4 border rounded shadow-md bg-white flex items-center space-x-4">
                {/* Placeholder for profile image */}
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-gray-500">
                    {/* Placeholder Icon or Image */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    {/* Later use: <img src={user.profileImageUrl || '/default-avatar.png'} alt="Profile" className="w-20 h-20 rounded-full object-cover" /> */}
                </div>
                <div>
                    <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                    <p className="text-sm text-gray-600 mt-1">Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
                    <p className="text-lg font-semibold mt-2">Total Points: {user.totalPoints ?? 0}</p>
                    {user.rank && <p className="text-sm text-gray-600">Rank: #{user.rank}</p>}
                    {user.bio && <p className="text-sm text-gray-700 mt-2">{user.bio}</p>}
                </div>
            </div>

            {/* Debate History Section */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Debate History</h2>
                {debates.length === 0 ? (
                    <p className="text-gray-500 italic">No debates found for this user.</p>
                ) : (
                    <ul className="space-y-3">
                        {debates.map((debate) => (
                            <li key={debate.debateId} className="p-3 border rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                                <Link href={`/debates/${debate.debateId}`} className="block">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-indigo-700">{debate.topic.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${debate.status === 'completed' ? 'bg-green-100 text-green-800' : debate.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {debate.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex justify-between">
                                        <span>Started: {new Date(debate.createdAt).toLocaleDateString()}</span>
                                        <span>Points: <span className={(debate.pointsEarned ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{(debate.pointsEarned ?? 0) >= 0 ? '+' : ''}{(debate.pointsEarned ?? 0).toFixed(1)}</span></span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {/* TODO: Add Achievements Section (FR-1.2.3) */}
        </div>
    );
}