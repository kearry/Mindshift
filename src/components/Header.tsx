'use client'; // This component uses hooks, so it must be a Client Component

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Header() {
    // useSession hook provides session data and status
    const { data: session, status } = useSession();
    const loading = status === 'loading';

    return (
        <header className="bg-gray-100 p-4 border-b">
            <nav className="container mx-auto flex justify-between items-center">
                <Link href="/" className="text-xl font-bold text-indigo-600">
                    MindShift
                </Link>
                <div className="space-x-4">
                    {/* Display loading state if session status is loading */}
                    {loading && <span>Loading...</span>}

                    {/* If session exists (user is logged in), show user info and Logout button */}
                    {session && !loading && (
                        <>
                            <span className="text-sm mr-2">
                                Signed in as {session.user?.name || session.user?.email}
                            </span>
                            <button
                                onClick={() => signOut()} // Call signOut function from next-auth
                                className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
                            >
                                Logout
                            </button>
                        </>
                    )}

                    {/* If no session (user is logged out), show Login button */}
                    {!session && !loading && (
                        <Link
                            href="/login" // Link to your login page
                            className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                        >
                            Login
                        </Link>
                        // Optionally add a Register link here too
                        // <Link href="/register">Register</Link>
                    )}
                </div>
            </nav>
        </header>
    );
}