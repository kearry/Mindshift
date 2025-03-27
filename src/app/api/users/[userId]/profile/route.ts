import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next"; // Need session to check follow status
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Use configured options

const prisma = new PrismaClient();

interface RouteParams {
    userId: string; // ID of the profile being viewed
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

export async function GET(
    request: Request,
    context: RouteContext
) {
    let userIdString: string | undefined;
    let profileUserId: number;

    // Get current logged-in user's ID (if any)
    const session = await getServerSession(authOptions);
    const loggedInUserIdString = session?.user?.id;
    const loggedInUserId = loggedInUserIdString ? parseInt(loggedInUserIdString, 10) : null;

    try {
        // Validate userId from route parameter (the profile being viewed)
        const params = await context.params;
        userIdString = params.userId;
        profileUserId = parseInt(userIdString, 10); // Renamed to avoid confusion
        if (isNaN(profileUserId)) {
            return NextResponse.json({ error: 'Invalid User ID format' }, { status: 400 });
        }

        // Fetch User data
        const user = await prisma.user.findUnique({
            where: { userId: profileUserId },
            select: {
                userId: true, username: true, displayName: true, profileImageUrl: true,
                bio: true, createdAt: true, totalPoints: true, rank: true,
                // Count followers/following (Example - can be heavy, consider alternatives for perf)
                _count: {
                    select: { followers: true, following: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch User's Debates (remains the same)
        const debates = await prisma.debate.findMany({
            where: { userId: profileUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                debateId: true, topic: { select: { topicId: true, name: true } },
                status: true, pointsEarned: true, createdAt: true, completedAt: true,
            }
        });

        // --- Check Follow Status ---
        let isFollowing = false;
        if (loggedInUserId && loggedInUserId !== profileUserId) {
            // Check if a follow record exists from logged-in user to profile user
            const followStatus = await prisma.userFollows.findUnique({
                where: {
                    followerId_followedId: {
                        followerId: loggedInUserId,
                        followedId: profileUserId,
                    }
                },
                select: { followId: true } // Select minimal field just to check existence
            });
            isFollowing = !!followStatus; // True if record exists, false otherwise
        }
        // --- End Check Follow Status ---

        // Combine profile data including follow status and counts
        const profileData = {
            user: {
                ...user,
                // Add follower/following counts from _count
                followersCount: user._count.followers,
                followingCount: user._count.following,
            },
            debates: debates,
            // Add follow status relative to the logged-in user
            viewerIsFollowing: isFollowing,
            // Indicate if the viewer is viewing their own profile
            isOwnProfile: loggedInUserId === profileUserId,
        };

        // Remove _count from the user object before sending if desired
        // delete (profileData.user as any)._count;

        return NextResponse.json(profileData);

    } catch (error) {
        console.error(`Error fetching profile for user ${userIdString ?? '[unknown ID]'}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}