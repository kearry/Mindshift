'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Topic, User, Argument, Debate, Comment } from '@prisma/client';
import DebateHeader from '@/components/Debates/DebateHeader';
import StanceIndicator from '@/components/Debates/StanceIndicator';
import ArgumentHistory from '@/components/Debates/ArgumentHistory';
import ArgumentInput from '@/components/Debates/ArgumentInput';
import DebateSummary from '@/components/Debates/DebateSummary';
import CommentSection from '@/components/Debates/CommentSection';

// --- Type Definitions ---
export type DebateUser = Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl'>;
export type TopicInfo = Pick<Topic, 'topicId' | 'name' | 'description'>;
export interface ArgumentInfo extends Omit<Argument, 'debate' | 'user' | 'createdAt'> {
    createdAt: string;
    user: DebateUser | null;
}
export interface CommentInfo extends Pick<Comment, 'commentId' | 'commentText' | 'createdAt' | 'parentId' | 'updatedAt' | 'isDeleted'> {
    user: DebateUser;
}
export interface FullDebateInfo extends Omit<Debate, 'topic' | 'user' | 'arguments' | 'createdAt' | 'completedAt'> {
    createdAt: string;
    completedAt: string | null;
    topic: TopicInfo;
    user: DebateUser;
    arguments: ArgumentInfo[];
    summaryArticle: string | null;
}

export default function DebatePage() {
    const params = useParams();
    const { data: session, status: sessionStatus } = useSession();
    const [debate, setDebate] = useState<FullDebateInfo | null>(null);
    const [comments, setComments] = useState<CommentInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const debateIdStr = Array.isArray(params.debateId) ? params.debateId[0] : params.debateId;
    const debateId = parseInt(debateIdStr ?? '', 10);

    // Fetch debate and comments data
    const fetchDebateAndComments = useCallback(async (fetchComments = true) => {
        setLoading(true);
        setError(null);

        if (isNaN(debateId)) {
            setError("Invalid Debate ID format");
            setLoading(false);
            return;
        }

        try {
            const baseUrl = window.location.origin;

            // Fetch debate
            const debateResponse = await fetch(`${baseUrl}/api/debates/${debateId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
            });

            if (!debateResponse.ok) {
                const errorData = await debateResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch debate: ${debateResponse.status}`);
            }

            const debateData: FullDebateInfo = await debateResponse.json();
            setDebate(debateData);

            // Fetch comments if needed
            if (fetchComments) {
                const commentsResponse = await fetch(`${baseUrl}/api/debates/${debateId}/comments`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                });

                if (!commentsResponse.ok) {
                    const errorData = await commentsResponse.json().catch(() => ({}));
                    console.warn(`Comments fetch failed: ${errorData.error || commentsResponse.status}`);
                    setComments([]);
                } else {
                    const commentsData: CommentInfo[] = await commentsResponse.json();
                    setComments(commentsData);
                }
            }
        } catch (err: unknown) {
            console.error("Fetch error:", err);
            setError(err instanceof Error ? err.message : "Failed to load debate data");
        } finally {
            setLoading(false);
        }
    }, [debateId]);

    // Initial fetch with polling for active debates
    useEffect(() => {
        if (debateIdStr) {
            // Initial fetch
            fetchDebateAndComments(true);

            // Set up polling for active debates
            let refreshInterval: NodeJS.Timeout | null = null;

            // Only set up polling if debate is active, but don't add debate to dependencies
            // This avoids the infinite fetch loop
            if (debate?.status === 'active') {
                refreshInterval = setInterval(() => {
                    // Only refresh debate data, not comments to reduce load
                    fetchDebateAndComments(false);
                }, 10000); // Check every 10 seconds
            }

            // Clean up interval on unmount
            return () => {
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
            };
        } else {
            setError("Debate ID missing");
            setLoading(false);
        }
    }, [debateIdStr, fetchDebateAndComments]); // IMPORTANT: debate is NOT a dependency

    // Submit argument handler
    const handleArgumentSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const argumentText = formData.get('argumentText') as string;

        if (!argumentText?.trim() || isNaN(debateId)) return;

        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/debates/${debateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ argumentText: argumentText.trim() }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to submit argument');
            }

            // Refetch after successful submission
            await fetchDebateAndComments(true);

            // Reset form
            form.reset();
        } catch (err: unknown) {
            console.error("Submit argument error:", err);
            setError(err instanceof Error ? err.message : "Could not submit argument");
        }
    };

    if (loading || sessionStatus === 'loading') return <p className="text-center mt-10">Loading debate...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!debate) return <p className="text-center mt-10">Debate not found.</p>;

    // Calculations for child components
    const latestArgument = debate.arguments[debate.arguments.length - 1];
    const currentStance = debate.status === 'completed'
        ? (debate.finalStance ?? debate.initialStance)
        : (latestArgument?.stanceAfter ?? debate.initialStance);
    const currentUserIdString = session?.user?.id;
    const isMyTurn = debate.status === 'active' &&
        currentUserIdString === debate.user.userId.toString() &&
        debate.turnCount % 2 === 0;

    return (
        <div>
            <DebateHeader
                debate={debate}
            />

            <StanceIndicator
                currentStance={currentStance}
                initialStance={debate.initialStance}
                status={debate.status}
            />

            <ArgumentHistory
                arguments={debate.arguments}
            />

            {debate.status === 'active' && (
                <ArgumentInput
                    isMyTurn={isMyTurn}
                    debateId={debateId}
                    turnCount={debate.turnCount}
                    maxTurns={debate.maxTurns}
                    onArgumentSubmitted={() => fetchDebateAndComments(true)}
                    sessionStatus={sessionStatus}
                />
            )}

            {(debate.status === 'completed' || debate.status === 'summary_failed') && (
                <DebateSummary
                    summaryArticle={debate.summaryArticle}
                    status={debate.status}
                />
            )}

            <CommentSection
                comments={comments}
                debateId={debateId}
                sessionStatus={sessionStatus}
                onCommentSubmitted={() => fetchDebateAndComments(true)}
            />

            {/* Fallback Status Display */}
            {debate.status !== 'active' && !debate.summaryArticle && (
                <p className="text-center font-semibold mt-4">This debate is {debate.status}.</p>
            )}
        </div>
    );
}