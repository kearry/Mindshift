import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client'; // Import Prisma namespace
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface RouteParams {
    userId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// --- GET Handler (from previous step) ---
export async function GET(request: Request, context: RouteContext) {
    let userIdString: string | undefined; let profileUserId: number;
    const session = await getServerSession(authOptions);
    const loggedInUserIdString = session?.user?.id;
    const loggedInUserId = loggedInUserIdString ? parseInt(loggedInUserIdString, 10) : null;

    try {
        const params = await context.params; userIdString = params.userId; profileUserId = parseInt(userIdString, 10);
        if (isNaN(profileUserId)) return NextResponse.json({ error: 'Invalid User ID format' }, { status: 400 });

        const user = await prisma.user.findUnique({
            where: { userId: profileUserId },
            select: { userId: true, username: true, displayName: true, profileImageUrl: true, bio: true, createdAt: true, totalPoints: true, rank: true, _count: { select: { followers: true, following: true } } }
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const debates = await prisma.debate.findMany({ where: { userId: profileUserId }, orderBy: { createdAt: 'desc' }, select: { debateId: true, topic: { select: { topicId: true, name: true } }, status: true, pointsEarned: true, createdAt: true, completedAt: true, } });

        let isFollowing = false;
        if (loggedInUserId && loggedInUserId !== profileUserId) {
            const followStatus = await prisma.userFollows.findUnique({ where: { followerId_followedId: { followerId: loggedInUserId, followedId: profileUserId } }, select: { followId: true } });
            isFollowing = !!followStatus;
        }

        const profileData = { user: { ...user, followersCount: user._count.followers, followingCount: user._count.following, }, debates: debates, viewerIsFollowing: isFollowing, isOwnProfile: loggedInUserId === profileUserId, };
        // delete (profileData.user as any)._count; // Clean up _count if not needed directly

        return NextResponse.json(profileData);

    } catch (error) { /* ... unchanged GET error handling ... */
        console.error(`Error fetching profile for user ${userIdString ?? '[unknown ID]'}:`, error); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// --- PUT Handler (New - Update User Profile) ---
export async function PUT(
    request: Request,
    context: RouteContext
) {
    // 1. Get Authenticated User
    const session = await getServerSession(authOptions);
    const loggedInUserIdString = session?.user?.id;
    const loggedInUserId = loggedInUserIdString ? parseInt(loggedInUserIdString, 10) : null;

    if (!session || !loggedInUserId || isNaN(loggedInUserId)) {
        return NextResponse.json({ error: 'Unauthorized - Must be logged in' }, { status: 401 });
    }

    let targetUserIdString: string | undefined;
    let targetUserId: number;

    try {
        // 2. Get Target User ID from URL
        const params = await context.params;
        targetUserIdString = params.userId;
        targetUserId = parseInt(targetUserIdString, 10);
        if (isNaN(targetUserId)) {
            return NextResponse.json({ error: 'Invalid User ID format' }, { status: 400 });
        }

        // 3. Authorization: Ensure user is updating their OWN profile
        if (loggedInUserId !== targetUserId) {
            return NextResponse.json({ error: 'Forbidden - Cannot update another user\'s profile' }, { status: 403 });
        }

        // 4. Get Updated Data from Request Body
        const body = await request.json();
        const { displayName, bio /*, profileImageUrl */ } = body; // Add other editable fields as needed

        // 5. Prepare Data for Update (only include fields that were actually provided)
        const dataToUpdate: Prisma.UserUpdateInput = {};
        if (displayName !== undefined && typeof displayName === 'string') {
            dataToUpdate.displayName = displayName.trim();
        }
        if (bio !== undefined && typeof bio === 'string') {
            // Allow empty string for bio, trim otherwise
            dataToUpdate.bio = bio.trim();
        }
        // Add validation/handling for profileImageUrl if implementing later

        if (Object.keys(dataToUpdate).length === 0) {
            return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
        }

        // 6. Update User in Database
        const updatedUser = await prisma.user.update({
            where: { userId: loggedInUserId },
            data: dataToUpdate,
            // Select fields to return (exclude sensitive ones)
            select: { userId: true, username: true, displayName: true, profileImageUrl: true, bio: true, createdAt: true, totalPoints: true, rank: true }
        });

        console.log(`User profile updated for userId: ${loggedInUserId}`);
        return NextResponse.json(updatedUser, { status: 200 });

    } catch (error: unknown) {
        console.error(`Error updating profile for user ${targetUserIdString ?? '[unknown ID]'}:`, error);
        // Handle potential unique constraint errors if username were editable, etc.
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}