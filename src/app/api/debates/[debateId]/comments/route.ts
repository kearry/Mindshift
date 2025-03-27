import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface RouteParams {
    debateId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// --- GET Handler (remains the same) ---
export async function GET(request: Request, context: RouteContext) {
    let debateIdString: string | undefined; let debateId: number;
    try {
        const params = await context.params; debateIdString = params.debateId; debateId = parseInt(debateIdString, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });
        const comments = await prisma.comment.findMany({ where: { debateId: debateId, isDeleted: false }, include: { user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } } }, orderBy: { createdAt: 'asc' } });
        return NextResponse.json(comments);
    } catch (error) { console.error(`Error fetching comments for debate ${debateIdString ?? '[unknown ID]'}:`, error); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

// --- POST Handler (Use commenterName) ---
export async function POST(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions);
    const commenterIdString = session?.user?.id;
    const commenterId = commenterIdString ? parseInt(commenterIdString, 10) : null;
    // Use the name from the session for the notification content
    const commenterName = session?.user?.name || session?.user?.email || 'Someone'; // Get commenter name

    if (!session || !commenterId || isNaN(commenterId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let debateIdString: string | undefined; let debateId: number;

    try {
        const params = await context.params; debateIdString = params.debateId; debateId = parseInt(debateIdString, 10); if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });

        const body = await request.json(); const { commentText, parentId } = body;
        if (!commentText?.trim()) return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
        const parsedParentId = parentId ? parseInt(parentId, 10) : null; if (parentId && (parsedParentId === null || isNaN(parsedParentId))) return NextResponse.json({ error: 'Invalid parent comment ID' }, { status: 400 });

        const debate = await prisma.debate.findUnique({ where: { debateId }, select: { userId: true, topic: { select: { name: true } } } });
        if (!debate) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        const debateOwnerId = debate.userId;

        const newComment = await prisma.$transaction(async (tx) => {
            const createdComment = await tx.comment.create({
                data: { commentText: commentText.trim(), debateId: debateId, userId: commenterId, parentId: parsedParentId },
                include: { user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } } }
            });
            if (commenterId !== debateOwnerId) {
                await tx.notification.create({
                    data: {
                        userId: debateOwnerId, notificationType: 'NEW_COMMENT_ON_DEBATE',
                        relatedUserId: commenterId, relatedDebateId: debateId, relatedCommentId: createdComment.commentId,
                        // Use the commenterName variable here
                        content: `@${commenterName} commented on your debate about "${debate.topic.name}".`
                    }
                });
                console.log(`Notification created for user ${debateOwnerId} about comment ${createdComment.commentId} on debate ${debateId}`);
            }
            return createdComment;
        });
        return NextResponse.json(newComment, { status: 201 });

    } catch (error: unknown) { /* ... unchanged error handling ... */
        console.error(`Error posting comment for debate ${debateIdString ?? '[unknown ID]'}:`, error); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') { if (error.meta?.field_name === 'comments_parentId_fkey (index)') return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 }); } const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'; return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        // await prisma.$disconnect();
    }
}