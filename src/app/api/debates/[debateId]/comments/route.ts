import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Use configured options

const prisma = new PrismaClient();

interface RouteParams {
    debateId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams; // Handle potential promise for params
}

// --- GET Handler (Fetch Comments for a Debate) ---
export async function GET(
    request: Request, // Keep request param for potential query params later (e.g., pagination)
    context: RouteContext
) {
    let debateIdString: string | undefined;
    let debateId: number;

    try {
        const params = await context.params;
        debateIdString = params.debateId;
        debateId = parseInt(debateIdString, 10);
        if (isNaN(debateId)) {
            return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });
        }

        // Fetch comments, including user info, ordered by creation date
        const comments = await prisma.comment.findMany({
            where: {
                debateId: debateId,
                isDeleted: false, // Only fetch non-deleted comments
                // parentId: null, // Optionally fetch only top-level comments initially
            },
            include: {
                user: { // Include commenter's details
                    select: { userId: true, username: true, displayName: true, profileImageUrl: true }
                },
                // Optionally include replies count or nested replies later
                // _count: { select: { replies: true } }
            },
            orderBy: {
                createdAt: 'asc', // Show oldest comments first
            },
            // Add pagination later if needed (skip, take)
        });

        return NextResponse.json(comments);

    } catch (error) {
        console.error(`Error fetching comments for debate ${debateIdString ?? '[unknown ID]'}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}


// --- POST Handler (Create a New Comment) ---
export async function POST(
    request: Request,
    context: RouteContext
) {
    // 1. Check Authentication
    const session = await getServerSession(authOptions);
    const userIdString = session?.user?.id;
    const userId = userIdString ? parseInt(userIdString, 10) : null;

    if (!session || !userId || isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized - Must be logged in to comment' }, { status: 401 });
    }

    let debateIdString: string | undefined;
    let debateId: number;

    try {
        // 2. Get debateId and comment data
        const params = await context.params;
        debateIdString = params.debateId;
        debateId = parseInt(debateIdString, 10);
        if (isNaN(debateId)) {
            return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });
        }

        const body = await request.json();
        const { commentText, parentId } = body; // parentId is optional for replies

        // 3. Validate Input
        if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
            return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
        }
        const parsedParentId = parentId ? parseInt(parentId, 10) : null;
        if (parentId && (parsedParentId === null || isNaN(parsedParentId))) {
            return NextResponse.json({ error: 'Invalid parent comment ID' }, { status: 400 });
        }

        // 4. Check if Debate exists and is completed (optional, maybe allow comments on active?)
        // Let's allow comments on any non-deleted debate for now
        const debateExists = await prisma.debate.findUnique({ where: { debateId } });
        if (!debateExists) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }
        // Add check for debate status if needed:
        // if (debateExists.status !== 'completed') {
        //    return NextResponse.json({ error: 'Can only comment on completed debates' }, { status: 400 });
        // }


        // 5. Create Comment
        const newComment = await prisma.comment.create({
            data: {
                commentText: commentText.trim(),
                debateId: debateId,
                userId: userId,
                parentId: parsedParentId, // Will be null if not provided
            },
            // Include user data in the response
            include: {
                user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } }
            }
        });

        // Optional: Trigger notification for debate owner or parent comment owner

        return NextResponse.json(newComment, { status: 201 });

    } catch (error: unknown) {
        console.error(`Error posting comment for debate ${debateIdString ?? '[unknown ID]'}:`, error);
        // Handle specific errors like parent comment not found (P2003 if foreign key constraint fails)
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
            if (error.meta?.field_name === 'comments_parentId_fkey (index)') {
                return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
            }
        }
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}