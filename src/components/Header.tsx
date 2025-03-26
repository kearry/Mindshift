// src/components/Header.tsx
'use client';

import Link from 'next/link';
// Removed signIn import as it's not used directly here anymore
import { useSession, signOut } from 'next-auth/react';

export default function Header() {
    const { data: session, status } = useSession();
    const loading = status === 'loading';

    return (
        <header className="bg-gray-100 p-4 border-b">
            <nav className="container mx-auto flex justify-between items-center">
                <Link href="/" className="text-xl font-bold text-indigo-600">
                    MindShift
                </Link>
                <div className="space-x-4">
                    {loading && <span>Loading...</span>}
                    {session && !loading && (
                        <>
                            <span className="text-sm mr-2">
                                Signed in as {session.user?.name || session.user?.email}
                            </span>
                            <button
                                onClick={() => signOut()}
                                className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
                            >
                                Logout
                            </button>
                        </>
                    )}
                    {!session && !loading && (
                        <Link
                            href="/login"
                            className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                        >
                            Login
                        </Link>
                        // <Link href="/register" className="text-sm text-gray-600 hover:underline">Register</Link>
                    )}
                </div>
            </nav>
        </header>
    );
}