import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Use configured options

const prisma = new PrismaClient();

interface RouteParams {
    userId: string; // ID of the user being followed/unfollowed
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// --- POST Handler (Follow User) ---
export async function POST(
    request: Request, // Request might be unused but keep for consistency
    context: RouteContext
) {
    // 1. Get Authenticated User (Follower)
    const session = await getServerSession(authOptions);
    const followerIdString = session?.user?.id;
    const followerId = followerIdString ? parseInt(followerIdString, 10) : null;

    if (!session || !followerId || isNaN(followerId)) {
        return NextResponse.json({ error: 'Unauthorized - Must be logged in to follow' }, { status: 401 });
    }

    let followedIdString: string | undefined;
    let followedId: number;

    try {
        // 2. Get User Being Followed from URL
        const params = await context.params;
        followedIdString = params.userId;
        followedId = parseInt(followedIdString, 10);
        if (isNaN(followedId)) {
            return NextResponse.json({ error: 'Invalid User ID to follow' }, { status: 400 });
        }

        // 3. Validate: Cannot follow self
        if (followerId === followedId) {
            return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
        }

        // 4. Check if user being followed exists (optional but good practice)
        const followedUserExists = await prisma.user.findUnique({ where: { userId: followedId } });
        if (!followedUserExists) {
            return NextResponse.json({ error: 'User to follow not found' }, { status: 404 });
        }

        // 5. Create Follow Relationship
        // Use create to leverage the @@unique constraint - it will error if already followed
        const newFollow = await prisma.userFollows.create({
            data: {
                followerId: followerId,
                followedId: followedId,
            }
        });

        console.log(`User ${followerId} started following user ${followedId}`);
        return NextResponse.json({ message: 'User followed successfully', follow: newFollow }, { status: 201 });

    } catch (error: unknown) {
        // Handle potential errors, e.g., unique constraint violation if already following
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json({ error: 'Already following this user' }, { status: 409 }); // 409 Conflict
        }
        console.error(`Error following user ${followedIdString}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}


// --- DELETE Handler (Unfollow User) ---
export async function DELETE(
    request: Request, // Request might be unused but keep for consistency
    context: RouteContext
) {
    // 1. Get Authenticated User (Follower)
    const session = await getServerSession(authOptions);
    const followerIdString = session?.user?.id;
    const followerId = followerIdString ? parseInt(followerIdString, 10) : null;

    if (!session || !followerId || isNaN(followerId)) {
        return NextResponse.json({ error: 'Unauthorized - Must be logged in to unfollow' }, { status: 401 });
    }

    let followedIdString: string | undefined;
    let followedId: number;

    try {
        // 2. Get User Being Unfollowed from URL
        const params = await context.params;
        followedIdString = params.userId;
        followedId = parseInt(followedIdString, 10);
        if (isNaN(followedId)) {
            return NextResponse.json({ error: 'Invalid User ID to unfollow' }, { status: 400 });
        }

        // 3. Delete Follow Relationship
        // Use the unique compound key defined in the schema
        await prisma.userFollows.delete({
            where: {
                followerId_followedId: {
                    followerId: followerId,
                    followedId: followedId,
                }
            }
        });

        console.log(`User ${followerId} unfollowed user ${followedId}`);
        return NextResponse.json({ message: 'User unfollowed successfully' }, { status: 200 });

    } catch (error: unknown) {
        // Handle potential errors, e.g., record to delete not found
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            // Record to delete was not found - arguably okay, user wasn't following anyway
            // return NextResponse.json({ error: 'Not following this user' }, { status: 404 });
            // Or just return success:
            return NextResponse.json({ message: 'User was not being followed' }, { status: 200 });
        }
        console.error(`Error unfollowing user ${followedIdString}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}