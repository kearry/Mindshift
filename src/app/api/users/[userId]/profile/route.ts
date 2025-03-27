import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteParams {
    userId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

export async function GET(
    request: Request,
    context: RouteContext
) {
    let userIdString: string | undefined;
    let userId: number;

    try {
        // Validate userId from route parameter
        const params = await context.params;
        userIdString = params.userId;
        userId = parseInt(userIdString, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Invalid User ID format' }, { status: 400 });
        }

        // Fetch User data (select specific fields for privacy/efficiency)
        const user = await prisma.user.findUnique({
            where: { userId: userId },
            select: {
                userId: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
                bio: true,
                createdAt: true,
                totalPoints: true, // Include total points accumulated
                rank: true, // Include rank if available
                // Exclude sensitive fields like email, passwordHash, isAdmin etc.
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch User's Debates (select relevant fields)
        const debates = await prisma.debate.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' }, // Show most recent first
            select: {
                debateId: true,
                topic: { select: { topicId: true, name: true } }, // Get topic name
                status: true,
                pointsEarned: true,
                createdAt: true,
                completedAt: true,
                // Add other fields if needed for history display
            }
        });

        // Combine user data and debates into a profile object
        const profileData = {
            user: user,
            debates: debates,
        };

        return NextResponse.json(profileData);

    } catch (error) {
        console.error(`Error fetching profile for user ${userIdString ?? '[unknown ID]'}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect(); // Manage client lifecycle
    }
}