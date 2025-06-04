import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client'; // Import Prisma for types
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

interface RouteParams {
    userId: string; // ID of the user being followed/unfollowed
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// --- POST Handler (Follow User + Create Notification) ---
export async function POST(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions);
    const followerIdString = session?.user?.id;
    const followerId = followerIdString ? parseInt(followerIdString, 10) : null;
    if (!session || !followerId || isNaN(followerId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let followedIdString: string | undefined;
    let followedId: number;

    try {
        const params = await context.params;
        followedIdString = params.userId;
        followedId = parseInt(followedIdString, 10);
        if (isNaN(followedId)) return NextResponse.json({ error: 'Invalid User ID to follow' }, { status: 400 });
        if (followerId === followedId) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

        const followedUserExists = await prisma.user.findUnique({ where: { userId: followedId }, select: { userId: true, username: true } }); // Select username for notification
        if (!followedUserExists) return NextResponse.json({ error: 'User to follow not found' }, { status: 404 });

        // Use transaction to ensure follow and notification creation are linked (optional but safer)
        const result = await prisma.$transaction(async (tx) => {
            const newFollow = await tx.userFollows.create({ data: { followerId: followerId, followedId: followedId } });

            // Create notification for the user who was followed
            await tx.notification.create({
                data: {
                    userId: followedId, // The user being notified
                    notificationType: 'NEW_FOLLOWER',
                    relatedUserId: followerId, // The user who performed the action
                    content: `User @${session.user?.name || 'Someone'} started following you.` // Use username/name from session
                    // relatedDebateId and relatedCommentId are null
                }
            });
            return newFollow;
        });

        console.log(`User ${followerId} followed user ${followedId}, notification created.`);
        return NextResponse.json({ message: 'User followed successfully', follow: result }, { status: 201 });

    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json({ error: 'Already following this user' }, { status: 409 });
        }
        console.error(`Error following user ${followedIdString}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}

// --- DELETE Handler (Unfollow User - no notification needed) ---
export async function DELETE(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions);
    const followerIdString = session?.user?.id;
    const followerId = followerIdString ? parseInt(followerIdString, 10) : null;
    if (!session || !followerId || isNaN(followerId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let followedIdString: string | undefined;
    let followedId: number;

    try {
        const params = await context.params;
        followedIdString = params.userId;
        followedId = parseInt(followedIdString, 10);
        if (isNaN(followedId)) return NextResponse.json({ error: 'Invalid User ID to unfollow' }, { status: 400 });

        await prisma.userFollows.delete({ where: { followerId_followedId: { followerId: followerId, followedId: followedId } } });

        console.log(`User ${followerId} unfollowed user ${followedId}`);
        return NextResponse.json({ message: 'User unfollowed successfully' }, { status: 200 });
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ message: 'User was not being followed' }, { status: 200 });
        }
        console.error(`Error unfollowing user ${followedIdString}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}