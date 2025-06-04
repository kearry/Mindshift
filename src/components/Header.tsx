'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import type { Notification } from '@prisma/client';
import GlobalLLMSelector from './GlobalLLMSelector';

// Define expected fields from notification
type NotificationData = Pick<Notification, 'notificationId' | 'content' | 'createdAt' | 'isRead' | 'notificationType' | 'relatedDebateId' | 'relatedUserId' | 'relatedCommentId'>;

export default function Header() {
    const { data: session, status } = useSession();
    const loadingSession = status === 'loading';
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [markingRead, setMarkingRead] = useState(false);
    const [showLLMSettings, setShowLLMSettings] = useState(false);

    // Theme handling
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // After mounting, we can safely show the UI that depends on client-side data
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            if (status === 'authenticated') {
                setLoadingNotifications(true);
                try {
                    const response = await fetch('/api/notifications');
                    if (!response.ok) throw new Error('Failed to fetch notifications');

                    const data: NotificationData[] = await response.json();
                    setNotifications(data);
                    setUnreadCount(data.filter(n => !n.isRead).length);
                } catch (error) {
                    console.error("Error fetching notifications:", error);
                } finally {
                    setLoadingNotifications(false);
                }
            } else {
                setNotifications([]);
                setUnreadCount(0);
            }
        };

        fetchNotifications();
    }, [status]);

    const handleToggleNotifications = () => {
        setShowNotifications(prev => !prev);
    };

    const handleToggleLLMSettings = () => {
        setShowLLMSettings(prev => !prev);
    };

    const handleMarkAllRead = async () => {
        if (markingRead || unreadCount === 0) return;

        setMarkingRead(true);
        const originalNotifications = [...notifications];

        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);

        try {
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to mark notifications as read');
            }

            console.log("Successfully marked notifications as read");
        } catch (error) {
            // Revert on error
            console.error("Error marking notifications as read:", error);
            setNotifications(originalNotifications);
            setUnreadCount(originalNotifications.filter(n => !n.isRead).length);
        } finally {
            setMarkingRead(false);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <header className="bg-gray-100 dark:bg-gray-800 p-4 border-b sticky top-0 z-10">
            <nav className="container mx-auto flex justify-between items-center">
                <Link href="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">MindShift</Link>

                <div className="flex items-center space-x-4">
                    <Link href="/leaderboard" className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">Leaderboard</Link>

                    {/* Global LLM Settings */}
                    <div className="relative">
                        <button
                            onClick={handleToggleLLMSettings}
                            className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                            AI Settings
                        </button>
                        {showLLMSettings && (
                            <div className="absolute right-0 mt-2 z-20 bg-white dark:bg-gray-700 p-2 border rounded shadow">
                                <GlobalLLMSelector />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button
                                        onClick={() => setShowLLMSettings(false)}
                                        className="px-2 py-1 text-sm rounded bg-gray-200 dark:bg-gray-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => setShowLLMSettings(false)}
                                        className="px-2 py-1 text-sm rounded bg-blue-500 text-white"
                                    >
                                        Accept
                                    </button>
                                </div>

                            </div>
                        )}
                    </div>
                    {/* Theme Toggle - only show icon after component is mounted */}
                    <button
                        onClick={toggleTheme}
                        className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                        aria-label="Toggle theme"
                        suppressHydrationWarning
                    >
                        {mounted && (theme === 'dark' ? '🌞' : '🌙')}
                    </button>

                    {loadingSession && <span>Loading...</span>}

                    {session && !loadingSession && (
                        <>
                            {/* Notification Area */}
                            <div className="relative">
                                <button
                                    onClick={handleToggleNotifications}
                                    className="relative text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none"
                                    aria-label="Notifications"
                                >
                                    {/* Bell Icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>

                                    {/* Badge */}
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Dropdown */}
                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-700 rounded-md shadow-lg border dark:border-gray-600 max-h-96 overflow-y-auto z-20">
                                        <div className="py-2 px-3 border-b dark:border-gray-600 font-semibold text-sm flex justify-between items-center">
                                            <span>Notifications</span>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    disabled={markingRead}
                                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {markingRead ? 'Marking...' : 'Mark all as read'}
                                                </button>
                                            )}
                                        </div>

                                        {loadingNotifications ? (
                                            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                                        ) : notifications.length === 0 ? (
                                            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No notifications.</p>
                                        ) : (
                                            <ul className="divide-y divide-gray-100 dark:divide-gray-600">
                                                {notifications.map(n => (
                                                    <li
                                                        key={n.notificationId}
                                                        className={`p-3 text-sm transition-colors ${!n.isRead ? 'bg-indigo-50 dark:bg-indigo-900/30 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                                                    >
                                                        <p dangerouslySetInnerHTML={{ __html: n.content || '' }}></p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Profile Link */}
                            <Link
                                href={`/profile/${session.user?.id}`}
                                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                                {session.user?.name || session.user?.email}
                            </Link>

                            {/* Logout Button */}
                            <button
                                onClick={() => signOut()}
                                className="px-3 py-1 text-sm font-medium text-white bg-red-600 dark:bg-red-700 rounded hover:bg-red-700 dark:hover:bg-red-800"
                            >
                                Logout
                            </button>
                        </>
                    )}

                    {!session && !loadingSession && (
                        <Link
                            href="/login"
                            className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 rounded hover:bg-indigo-700 dark:hover:bg-indigo-800"
                        >
                            Login
                        </Link>
                    )}
                </div>
            </nav>
        </header>
    );
}