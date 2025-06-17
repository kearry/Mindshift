import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";


interface RouteParams {
    debateId: string;
}
interface RouteContext {
    params: Promise<RouteParams> | RouteParams;
}

// --- GET Handler ---
export async function GET(request: Request, context: RouteContext) {
    let debateIdString: string | undefined; let debateId: number;
    try {
        const params = await context.params;
        debateIdString = params.debateId;
        debateId = parseInt(debateIdString, 10);
        if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });

        const comments = await prisma.comment.findMany({
            where: {
                debateId: debateId,
                isDeleted: false,
            },
            include: {
                user: { // Include commenter's details
                    select: { userId: true, username: true, displayName: true, profileImageUrl: true }
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return NextResponse.json(comments);

    } catch (error) {
        console.error(`Error fetching comments for debate ${debateIdString ?? '[unknown ID]'}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- POST Handler ---
export async function POST(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions);
    const commenterIdString = session?.user?.id;
    const commenterId = commenterIdString ? parseInt(commenterIdString, 10) : null;

    // Get commenter name from session for notification
    const commenterUsername = session?.user?.name || 'Someone';

    if (!session || !commenterId || isNaN(commenterId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let debateIdString: string | undefined; let debateId: number;

    try {
        const params = await context.params;
        debateIdString = params.debateId;
        debateId = parseInt(debateIdString, 10);

        if (isNaN(debateId)) return NextResponse.json({ error: 'Invalid Debate ID format' }, { status: 400 });

        const body = await request.json();
        const { commentText, parentId } = body;

        if (!commentText?.trim()) return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });

        const parsedParentId = parentId ? parseInt(parentId, 10) : null;
        if (parentId && (parsedParentId === null || isNaN(parsedParentId))) {
            return NextResponse.json({ error: 'Invalid parent comment ID' }, { status: 400 });
        }

        const debate = await prisma.debate.findUnique({
            where: { debateId },
            select: { userId: true, topic: { select: { name: true } } }
        });

        if (!debate) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        const debateOwnerId = debate.userId;

        const newComment = await prisma.$transaction(async (tx) => {
            const createdComment = await tx.comment.create({
                data: {
                    commentText: commentText.trim(),
                    debateId: debateId,
                    userId: commenterId,
                    parentId: parsedParentId
                },
                include: {
                    user: { select: { userId: true, username: true, displayName: true, profileImageUrl: true } }
                }
            });

            if (commenterId !== debateOwnerId) {
                await tx.notification.create({
                    data: {
                        userId: debateOwnerId,
                        notificationType: 'NEW_COMMENT_ON_DEBATE',
                        relatedUserId: commenterId,
                        relatedDebateId: debateId,
                        relatedCommentId: createdComment.commentId,
                        content: `@${commenterUsername} commented on your debate about "${debate.topic.name}".`
                    }
                });
                console.log(`Notification created for user ${debateOwnerId}`);
            }

            // TODO: Add notification for parent comment author if it's a reply
            return createdComment;
        });

        return NextResponse.json(newComment, { status: 201 });

    } catch (error: unknown) {
        console.error(`Error posting comment for debate ${debateIdString ?? '[unknown ID]'}:`, error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            if (error.meta?.field_name === 'comments_parentId_fkey (index)') {
                return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
            }
        }

        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}