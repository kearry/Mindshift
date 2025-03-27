'use client'; // Need hooks for session and redirect

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect based on session status
  useEffect(() => {
    // If status determined and user is NOT authenticated, redirect to welcome page
    if (status === 'unauthenticated') {
      router.push('/welcome'); // <--- CHANGE: Redirect to /welcome
    }
    // No explicit redirect needed for 'authenticated', as content renders below
  }, [status, router]);

  // Show loading state
  if (status === 'loading') {
    return <p className="text-center mt-10">Loading...</p>;
  }

  // Render dashboard content if authenticated
  if (status === 'authenticated') {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">
          Welcome back, {session.user?.name || session.user?.email || 'User'}!
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Stats / Actions */}
          <div className="p-4 border rounded shadow-sm bg-white">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {/* <p>Your Points: [User Points]</p> */}
              <p><Link href="/topics" className="text-indigo-600 hover:underline">Explore Topics</Link></p>
              <p><Link href="/topics/create" className="text-indigo-600 hover:underline">Create a New Topic</Link></p>
              {session.user?.id && (<p><Link href={`/profile/${session.user.id}`} className="text-indigo-600 hover:underline">View Your Profile</Link></p>)}
            </div>
          </div>
          {/* Featured Debates (Placeholder) */}
          <div className="p-4 border rounded shadow-sm bg-white">
            <h2 className="text-lg font-semibold mb-3">Featured Debates</h2>
            <p className="text-gray-500 italic">Featured content coming soon...</p>
          </div>
          {/* Recent Activity (Placeholder) */}
          <div className="p-4 border rounded shadow-sm bg-white md:col-span-2">
            <h2 className="text-lg font-semibold mb-3">Your Recent Activity</h2>
            <p className="text-gray-500 italic">Activity feed coming soon...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render minimal content or nothing if redirecting
  return null; // Or a spinner while redirect occurs
}