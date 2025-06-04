'use client'; // Needs hooks for data fetching, params, state, and interaction

import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Topic, User, Debate } from '@prisma/client';

// Define types for the expected profile data structure from API
interface ProfileUserData extends Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl' | 'bio' | 'createdAt' | 'totalPoints' | 'rank'> {
    // Added counts from API
    followersCount: number;
    followingCount: number;
}
interface ProfileDebateData extends Pick<Debate, 'debateId' | 'status' | 'pointsEarned' | 'createdAt' | 'completedAt'> {
    topic: Pick<Topic, 'topicId' | 'name'>;
}
interface ProfileData {
    user: ProfileUserData;
    debates: ProfileDebateData[];
    viewerIsFollowing: boolean; // Added from API
    isOwnProfile: boolean; // Added from API
}

export default function UserProfilePage() {
    const params = useParams();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for follow button
    const [isFollowingOptimistic, setIsFollowingOptimistic] = useState(false);
    const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
    const [followError, setFollowError] = useState<string | null>(null);


    const userIdStr = Array.isArray(params.userId) ? params.userId[0] : params.userId;
    const userId = parseInt(userIdStr ?? '', 10);

    // Use useCallback for fetchProfile to avoid unnecessary re-creation
    const fetchProfile = useCallback(async () => {
        // Don't set loading true here if called as a refresh after follow/unfollow
        // setLoading(true);
        setError(null); // Clear previous errors on fetch

        if (isNaN(userId)) { setError("Invalid User ID format"); setLoading(false); return; }

        try {
            const response = await fetch(`/api/users/${userId}/profile`);
            if (!response.ok) { /* ... error handling ... */
                let errorMsg = `HTTP error! status: ${response.status}`; try { const d = await response.json(); errorMsg = d.error || errorMsg; } catch { } if (response.status === 404) { notFound(); return; } throw new Error(errorMsg);
            }
            const data: ProfileData = await response.json();
            setProfile(data);
            // --- Initialize optimistic state based on fetched data ---
            setIsFollowingOptimistic(data.viewerIsFollowing);
            // ---------------------------------------------------------
        } catch (err: unknown) {
            console.error("Fetch profile error:", err); setError(err instanceof Error ? err.message : "Failed to load profile");
        } finally {
            setLoading(false);
        }
        // Add userId to dependency array
    }, [userId]);


    // Initial fetch
    useEffect(() => {
        if (userIdStr) { fetchProfile(); } else { setError("User ID missing"); setLoading(false); }
    }, [userIdStr, fetchProfile]); // Include fetchProfile in dependency array


    // --- Handler for Follow/Unfollow Button ---
    const handleFollowToggle = async () => {
        if (isUpdatingFollow || !profile || profile.isOwnProfile) return; // Prevent action if updating or own profile

        setIsUpdatingFollow(true);
        setFollowError(null);
        const targetUserId = profile.user.userId;

        // Optimistic UI update
        const originalFollowState = isFollowingOptimistic;
        setIsFollowingOptimistic(!originalFollowState);

        try {
            const method = originalFollowState ? 'DELETE' : 'POST'; // DELETE if currently following, POST if not
            const response = await fetch(`/api/users/${targetUserId}/follow`, { method });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `Failed to ${originalFollowState ? 'unfollow' : 'follow'}`);
            }
            // Success! API confirmed the action.
            // Optionally refresh full profile data to get updated follower counts
            // await fetchProfile(); // Re-fetch might cause flicker, optimistic is often enough
            console.log(`Successfully ${originalFollowState ? 'unfollowed' : 'followed'} user ${targetUserId}`);


        } catch (err: unknown) {
            console.error("Follow/Unfollow error:", err);
            setFollowError(err instanceof Error ? err.message : 'Action failed');
            // Revert optimistic update on error
            setIsFollowingOptimistic(originalFollowState);
        } finally {
            setIsUpdatingFollow(false);
        }
    };
    // --- End Handler ---


    if (loading) return <p className="text-center mt-10">Loading profile...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!profile) return <p className="text-center mt-10">Profile not found.</p>;

    const { user, debates, isOwnProfile } = profile;

    return (
        <div className="container mx-auto p-4">
            {/* User Info Section */}
            <div className="mb-8 p-4 border rounded shadow-md bg-white flex flex-wrap items-center space-x-4">
                {/* ... avatar placeholder ... */}
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 shrink-0"> <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> </div>
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                        {/* --- Follow/Unfollow Button --- */}
                        {!isOwnProfile && (
                            <button
                                onClick={handleFollowToggle}
                                disabled={isUpdatingFollow}
                                className={`px-4 py-1 rounded text-sm font-medium border disabled:opacity-50 ${isFollowingOptimistic
                                    ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                    }`}
                            >
                                {isUpdatingFollow ? 'Updating...' : (isFollowingOptimistic ? 'Following' : 'Follow')}
                            </button>
                        )}
                        {/* -------------------------- */}
                    </div>
                    {followError && <p className="text-xs text-red-600 mt-1">{followError}</p>}

                    <p className="text-sm text-gray-600 mt-1">Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
                    {/* Display Follower Counts */}
                    <p className="text-xs text-gray-500 mt-1">
                        <span className="mr-3">{user.followingCount ?? 0} Following</span>
                        <span>{user.followersCount ?? 0} Followers</span>
                    </p>
                    <p className="text-lg font-semibold mt-2">Total Points: {user.totalPoints ?? 0}</p>
                    {user.rank && <p className="text-sm text-gray-600">Rank: #{user.rank}</p>}
                    {user.bio && <p className="text-sm text-gray-700 mt-2">{user.bio}</p>}
                </div>
            </div>

            {/* Debate History Section (unchanged) */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Debate History</h2>
                {debates.length === 0 ? <p className="text-gray-500 italic">No debates found.</p> : (
                    <ul className="space-y-3">{debates.map((debate) => (<li key={debate.debateId} className="p-3 border rounded bg-gray-50 hover:bg-gray-100 transition-colors"><Link href={`/debates/${debate.debateId}`} className="block"><div className="flex justify-between items-center"><span className="font-medium text-indigo-700">{debate.topic.name}</span><span className={`text-xs px-2 py-0.5 rounded-full ${debate.status === 'completed' ? 'bg-green-100 text-green-800' : debate.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{debate.status}</span></div><div className="text-xs text-gray-500 mt-1 flex justify-between"><span>Started: {new Date(debate.createdAt).toLocaleDateString()}</span><span>Points: <span className={(debate.pointsEarned ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{(debate.pointsEarned ?? 0) >= 0 ? '+' : ''}{(debate.pointsEarned ?? 0).toFixed(1)}</span></span></div></Link></li>))}</ul>
                )}
            </div>
        </div>
    );
}