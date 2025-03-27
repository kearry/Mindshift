'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Topic, User, Debate } from '@prisma/client';

// Type Definitions remain the same
interface ProfileUserData extends Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl' | 'bio' | 'createdAt' | 'totalPoints' | 'rank'> { followersCount: number; followingCount: number; }
interface ProfileDebateData extends Pick<Debate, 'debateId' | 'status' | 'pointsEarned' | 'createdAt' | 'completedAt'> { topic: Pick<Topic, 'topicId' | 'name'>; }
interface ProfileData { user: ProfileUserData; debates: ProfileDebateData[]; viewerIsFollowing: boolean; isOwnProfile: boolean; }


export default function UserProfilePage() {
    const params = useParams();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFollowingOptimistic, setIsFollowingOptimistic] = useState(false);
    const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
    const [followError, setFollowError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileSaveMessage, setProfileSaveMessage] = useState('');

    const userIdStr = Array.isArray(params.userId) ? params.userId[0] : params.userId;
    const userId = parseInt(userIdStr ?? '', 10); // Parse userId once

    // FIX: Correct dependency array for useCallback
    const fetchProfile = useCallback(async () => {
        setError(null); if (isNaN(userId)) { setError("Invalid User ID format"); setLoading(false); return; } try { const r = await fetch(`/api/users/${userId}/profile`); if (!r.ok) { let e = 'HTTP error!'; try { const d = await r.json(); e = d.error || e; } catch { } if (r.status === 404) { notFound(); return; } throw new Error(e); } const data: ProfileData = await r.json(); setProfile(data); setIsFollowingOptimistic(data.viewerIsFollowing); } catch (err: unknown) { console.error("Fetch profile error:", err); setError(err instanceof Error ? err.message : "Failed to load profile"); } finally { setLoading(false); }
    }, [userId]); // Depend only on the parsed numeric userId


    useEffect(() => {
        if (userIdStr) { // Check if userIdStr exists before calling fetch
            setLoading(true); // Set loading true when effect runs
            fetchProfile();
        } else { setError("User ID missing"); setLoading(false); }
    }, [userIdStr, fetchProfile]);


    const handleFollowToggle = async () => { /* ... unchanged ... */ if (isUpdatingFollow || !profile || profile.isOwnProfile) return; setIsUpdatingFollow(true); setFollowError(null); const targetUserId = profile.user.userId; const originalFollowState = isFollowingOptimistic; setIsFollowingOptimistic(!originalFollowState); try { const method = originalFollowState ? 'DELETE' : 'POST'; const response = await fetch(`/api/users/${targetUserId}/follow`, { method }); if (!response.ok) { const data = await response.json(); throw new Error(data.error || `Failed to ${originalFollowState ? 'unfollow' : 'follow'}`); } console.log(`Success: ${originalFollowState ? 'unfollowed' : 'followed'} ${targetUserId}`); } catch (err: unknown) { console.error("Follow/Unfollow error:", err); setFollowError(err instanceof Error ? err.message : 'Action failed'); setIsFollowingOptimistic(originalFollowState); } finally { setIsUpdatingFollow(false); } };
    const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => { /* ... unchanged ... */ event.preventDefault(); if (!profile || !profile.isOwnProfile || isSavingProfile) return; setIsSavingProfile(true); setProfileSaveMessage(''); const dataToUpdate = { displayName: editDisplayName.trim(), bio: editBio.trim() }; try { const response = await fetch(`/api/users/${profile.user.userId}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpdate), }); const updatedUserData = await response.json(); if (!response.ok) { throw new Error(updatedUserData.error || 'Failed to update profile'); } setProfile(prevProfile => prevProfile ? ({ ...prevProfile, user: { ...prevProfile.user, ...updatedUserData } }) : null); setProfileSaveMessage('Profile updated successfully!'); setIsEditing(false); } catch (err: unknown) { console.error("Profile update error:", err); setProfileSaveMessage(`Error: ${err instanceof Error ? err.message : 'Could not update profile.'}`); } finally { setIsSavingProfile(false); } };
    const startEditing = () => { if (!profile) return; setEditDisplayName(profile.user.displayName || ''); setEditBio(profile.user.bio || ''); setProfileSaveMessage(''); setIsEditing(true); };


    if (loading) return <p className="text-center mt-10">Loading profile...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!profile) return <p className="text-center mt-10">Profile not found.</p>;

    // FIX: Remove unused 'viewerIsFollowing' from destructuring
    const { user, debates, isOwnProfile } = profile;

    return (<div className="container mx-auto p-4"> <div className="mb-8 p-4 border rounded shadow-md bg-white"> {isEditing ? (<form onSubmit={handleProfileUpdate} className="space-y-4"> {/* ... edit form ... */} <h2 className="text-xl font-semibold">Edit Profile</h2> <div> <label htmlFor="editDisplayName" className="block text-sm font-medium text-gray-700">Display Name</label> <input id="editDisplayName" type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" /> </div> <div> <label htmlFor="editBio" className="block text-sm font-medium text-gray-700">Bio</label> <textarea id="editBio" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" /> </div> <div className="flex space-x-3"> <button type="submit" disabled={isSavingProfile} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait">{isSavingProfile ? 'Saving...' : 'Save Changes'}</button> <button type="button" onClick={() => setIsEditing(false)} disabled={isSavingProfile} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Cancel</button> </div> {profileSaveMessage && <p className={`text-sm mt-2 ${profileSaveMessage.startsWith('Error:') ? 'text-red-600' : 'text-green-600'}`}>{profileSaveMessage}</p>} </form>) : (<div className="flex flex-wrap items-center space-x-4"> {/* ... display view ... */} <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 shrink-0"> <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> </div> <div className="flex-grow"> <div className="flex justify-between items-start"> <div> <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1> <p className="text-sm text-gray-500">@{user.username}</p> </div> {isOwnProfile ? (<button onClick={startEditing} className="px-4 py-1 rounded text-sm font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">Edit Profile</button>) : (<button onClick={handleFollowToggle} disabled={isUpdatingFollow} className={`px-4 py-1 rounded text-sm font-medium border disabled:opacity-50 ${isFollowingOptimistic ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'}`}>{isUpdatingFollow ? 'Updating...' : (isFollowingOptimistic ? 'Following' : 'Follow')}</button>)} </div> {followError && !isOwnProfile && <p className="text-xs text-red-600 mt-1">{followError}</p>} <p className="text-sm text-gray-600 mt-1">Joined: {new Date(user.createdAt).toLocaleDateString()}</p> <p className="text-xs text-gray-500 mt-1"><span className="mr-3">{user.followingCount ?? 0} Following</span><span>{user.followersCount ?? 0} Followers</span></p> <p className="text-lg font-semibold mt-2">Total Points: {user.totalPoints ?? 0}</p> {user.rank && <p className="text-sm text-gray-600">Rank: #{user.rank}</p>} {user.bio && <p className="text-sm text-gray-700 mt-2">{user.bio}</p>} </div> </div>)} </div> {/* Debate History Section (unchanged) */} <div className="mb-8"> <h2 className="text-xl font-semibold mb-4">Debate History</h2> {debates.length === 0 ? <p className="text-gray-500 italic">No debates found.</p> : (<ul className="space-y-3">{debates.map((debate) => (<li key={debate.debateId} className="p-3 border rounded bg-gray-50 hover:bg-gray-100 transition-colors"><Link href={`/debates/${debate.debateId}`} className="block"><div className="flex justify-between items-center"><span className="font-medium text-indigo-700">{debate.topic.name}</span><span className={`text-xs px-2 py-0.5 rounded-full ${debate.status === 'completed' ? 'bg-green-100 text-green-800' : debate.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{debate.status}</span></div><div className="text-xs text-gray-500 mt-1 flex justify-between"><span>Started: {new Date(debate.createdAt).toLocaleDateString()}</span><span>Points: <span className={(debate.pointsEarned ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{(debate.pointsEarned ?? 0) >= 0 ? '+' : ''}{(debate.pointsEarned ?? 0).toFixed(1)}</span></span></div></Link></li>))}</ul>)} </div> </div>);
}