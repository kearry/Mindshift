import Link from 'next/link';

// Define the expected structure of a user entry from the leaderboard API
interface LeaderboardUser {
    userId: number;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    totalPoints: number;
    // rank?: number; // If rank is included from API
}

// Fetch data directly in the Server Component
async function getLeaderboardData(): Promise<LeaderboardUser[]> {
    try {
        // Fetch from the API route. Use absolute URL for server-side fetch if needed,
        // or ensure fetch works correctly with relative paths in your setup.
        // Using localhost here assumes server can reach itself during build/render.
        // Consider using process.env.NEXT_PUBLIC_APP_URL or similar for flexibility.
        const apiUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'; // Get base URL
        const response = await fetch(`${apiUrl}/api/leaderboard`, {
            cache: 'no-store', // Don't cache leaderboard data, fetch fresh
        });

        if (!response.ok) {
            // Log error details server-side
            console.error(`Leaderboard fetch failed: ${response.status} ${response.statusText}`);
            // Optionally try parsing error body: const errorData = await response.json();
            throw new Error('Failed to fetch leaderboard data');
        }
        const data: LeaderboardUser[] = await response.json();
        return data;
    } catch (error) {
        console.error("Error in getLeaderboardData:", error);
        return []; // Return empty array on error
    }
}

export default async function LeaderboardPage() {
    const leaderboardData = await getLeaderboardData();

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6 text-center">Leaderboard</h1>

            {leaderboardData.length === 0 ? (
                <p className="text-center text-gray-500 italic">Leaderboard is currently empty.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border rounded shadow">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Rank</th>
                                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">User</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Total Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {leaderboardData.map((user, index) => (
                                <tr key={user.userId} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-b">{index + 1}</td>
                                    <td className="px-6 py-2 whitespace-nowrap border-b">
                                        <Link href={`/profile/${user.userId}`} className="flex items-center group">
                                            {/* Basic avatar placeholder */}
                                            <div className="flex-shrink-0 h-8 w-8 bg-gray-300 rounded-full mr-3 flex items-center justify-center text-gray-500 text-xs">
                                                {/* {user.profileImageUrl ? <img className="h-8 w-8 rounded-full" src={user.profileImageUrl} alt="" /> : '?'} */}
                                                ?
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-indigo-600 group-hover:underline">{user.displayName || user.username}</div>
                                                <div className="text-xs text-gray-500">@{user.username}</div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right border-b font-semibold">{user.totalPoints ?? 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}