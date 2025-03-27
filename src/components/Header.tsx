'use client'; // Needs state, effects, interaction

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Notification } from '@prisma/client';

// FIX: Use Pick to define expected fields, avoid empty interface
type NotificationData = Pick<Notification, 'notificationId' | 'content' | 'createdAt' | 'isRead' | 'notificationType' | 'relatedDebateId' | 'relatedUserId' | 'relatedCommentId'>;


export default function Header() {
    const { data: session, status } = useSession();
    const loadingSession = status === 'loading';
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [markingRead, setMarkingRead] = useState(false);

    // Fetch notifications
    useEffect(() => { /* ... unchanged useEffect ... */
        const fetchNotifications = async () => { if (status === 'authenticated') { setLoadingNotifications(true); try { const response = await fetch('/api/notifications'); if (!response.ok) throw new Error('Failed to fetch notifications'); const data: NotificationData[] = await response.json(); setNotifications(data); setUnreadCount(data.filter(n => !n.isRead).length); } catch (error) { console.error("Error fetching notifications:", error); } finally { setLoadingNotifications(false); } } else { setNotifications([]); setUnreadCount(0); } }; fetchNotifications();
    }, [status]);


    const handleToggleNotifications = () => { setShowNotifications(prev => !prev); };
    const handleMarkAllRead = async () => { /* ... unchanged handleMarkAllRead ... */
        if (markingRead || unreadCount === 0) return; setMarkingRead(true); const originalNotifications = [...notifications]; setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); setUnreadCount(0); try { const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, }); if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Failed to mark notifications as read'); } console.log("Successfully marked notifications as read"); } catch (error) { console.error("Error marking notifications as read:", error); setNotifications(originalNotifications); setUnreadCount(originalNotifications.filter(n => !n.isRead).length); } finally { setMarkingRead(false); }
    };


    return (<header className="bg-gray-100 p-4 border-b sticky top-0 z-10"> <nav className="container mx-auto flex justify-between items-center"> <Link href="/" className="text-xl font-bold text-indigo-600">MindShift</Link> <div className="flex items-center space-x-4"> <Link href="/leaderboard" className="text-sm text-gray-600 hover:text-indigo-600">Leaderboard</Link> {loadingSession && <span>Loading...</span>} {session && !loadingSession && (<> <div className="relative"> {/* Notification Area */} <button onClick={handleToggleNotifications} className="relative text-gray-600 hover:text-indigo-600 focus:outline-none" aria-label="Notifications"> {/* Bell Icon */} <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> </svg> {/* Badge */} {unreadCount > 0 && (<span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{unreadCount}</span>)} </button> {/* Dropdown */} {showNotifications && (<div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border max-h-96 overflow-y-auto z-20"> <div className="py-2 px-3 border-b font-semibold text-sm flex justify-between items-center"> <span>Notifications</span> {unreadCount > 0 && (<button onClick={handleMarkAllRead} disabled={markingRead} className="text-xs text-indigo-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">{markingRead ? 'Marking...' : 'Mark all as read'}</button>)} </div> {loadingNotifications ? (<p className="p-4 text-sm text-gray-500">Loading...</p>) : notifications.length === 0 ? (<p className="p-4 text-sm text-gray-500">No notifications.</p>) : (<ul className="divide-y divide-gray-100">{notifications.map(n => (<li key={n.notificationId} className={`p-3 text-sm transition-colors ${!n.isRead ? 'bg-indigo-50 font-medium' : 'text-gray-600'}`}> <p>{n.content}</p> <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p> </li>))}</ul>)} </div>)} </div> {/* Profile Link */} <Link href={`/profile/${session.user?.id}`} className="text-sm font-medium text-gray-700 hover:text-indigo-600">{session.user?.name || session.user?.email}</Link> {/* Logout Button */} <button onClick={() => signOut()} className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700">Logout</button> </>)} {!session && !loadingSession && (<Link href="/login" className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700">Login</Link>)} </div> </nav> </header>);
}