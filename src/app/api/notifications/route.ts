import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";


// Removed unused 'request' parameter
export async function GET() {
    const session = await getServerSession(authOptions);
    const userIdString = session?.user?.id;
    const userId = userIdString ? parseInt(userIdString, 10) : null;
    if (!session || !userId || isNaN(userId)) {
        return NextResponse.json([], { status: 200 });
    }
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: userId }, orderBy: { createdAt: 'desc' }, take: 50,
        });
        return NextResponse.json(notifications);
    } catch (error: unknown) {
        console.error(`Error fetching notifications for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}

// Removed unused 'request' parameter
export async function PATCH() {
    const session = await getServerSession(authOptions);
    const userIdString = session?.user?.id;
    const userId = userIdString ? parseInt(userIdString, 10) : null;
    if (!session || !userId || isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const updateResult = await prisma.notification.updateMany({
            where: { userId: userId, isRead: false },
            data: { isRead: true },
        });
        console.log(`Marked ${updateResult.count} notifications as read for user ${userId}`);
        return NextResponse.json({ message: 'Notifications marked as read', count: updateResult.count }, { status: 200 });
    } catch (error: unknown) {
        console.error(`Error marking notifications as read for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}