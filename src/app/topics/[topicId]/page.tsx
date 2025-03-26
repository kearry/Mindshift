// src/app/topics/[topicId]/page.tsx
'use client';

import { Topic } from '@prisma/client';
// Removed unused notFound import
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function TopicDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();

    const [topic, setTopic] = useState<Topic | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [goalDirection, setGoalDirection] = useState<'left' | 'right' | null>(null);
    const [startDebateMessage, setStartDebateMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const topicIdStr = Array.isArray(params.topicId) ? params.topicId[0] : params.topicId;

    useEffect(() => {
        const fetchTopic = async () => {
            setLoading(true);
            setError(null);
            setTopic(null);
            if (typeof topicIdStr !== 'string') {
                setError("Invalid Topic ID parameter"); setLoading(false); return;
            }
            const topicId = parseInt(topicIdStr, 10);
            if (isNaN(topicId)) {
                setError("Invalid Topic ID format"); setLoading(false); return;
            }
            try {
                const response = await fetch(`/api/topics/${topicId}`);
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch { /* Ignore */ }
                    if (response.status === 404) { setError('Topic not found'); } else { throw new Error(errorMsg); }
                } else {
                    const data: Topic = await response.json(); setTopic(data);
                }
            } catch (err: unknown) {
                console.error("Fetch topic error:", err);
                setError(err instanceof Error ? err.message : "Failed to load topic");
            } finally {
                setLoading(false);
            }
        };
        if (topicIdStr) { fetchTopic(); } else { setError("Topic ID missing in URL"); setLoading(false); }
    }, [topicIdStr]);

    const handleStartDebate = async () => {
        setStartDebateMessage('');
        if (isSubmitting || !topic || !goalDirection) { setStartDebateMessage('Please select a goal direction first.'); return; }
        if (!session?.user) { setStartDebateMessage('Please log in to start a debate.'); return; }
        setIsSubmitting(true);
        setStartDebateMessage('Starting debate...');
        try {
            const response = await fetch('/api/debates', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topicId: topic.topicId, goalDirection: goalDirection }),
            });
            const data = await response.json();
            if (response.ok && data.debateId) {
                setStartDebateMessage(`Debate created successfully! Redirecting...`);
                router.push(`/debates/${data.debateId}`);
            } else { throw new Error(data.error || 'Failed to start debate'); }
        } catch (error: unknown) {
            console.error('Start debate error:', error);
            setStartDebateMessage(`Error: ${error instanceof Error ? error.message : 'Could not start debate.'}`);
            setIsSubmitting(false);
        }
    };

    if (loading || sessionStatus === 'loading') return <p className="text-center mt-10">Loading topic...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!topic) return <p className="text-center mt-10">Topic not found.</p>;

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">{topic.name}</h1>
            {topic.description && <p className="text-gray-700 mb-4">{topic.description}</p>}
            <p className="text-sm text-gray-600 mb-1">Category: {topic.category || 'N/A'}</p>
            <p className="text-sm text-gray-600 mb-4">Initial Stance: {topic.currentStance}/10 ({topic.stanceReasoning || 'No reasoning provided'})</p>
            {sessionStatus === 'authenticated' ? (<div className="mt-6 p-4 border rounded bg-gray-50">
                <h3 className="text-lg font-semibold mb-3 text-center">Start a Debate</h3>
                <p className="text-sm text-center mb-4">Select the direction you want to shift the AI&apos;s stance:</p>
                <div className="flex justify-center space-x-4 mb-4">
                    <button onClick={() => setGoalDirection('left')} disabled={isSubmitting} className={`px-4 py-2 rounded border ${goalDirection === 'left' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'} disabled:opacity-50 disabled:cursor-not-allowed`}>Shift Left (More Supportive: 0-4)</button>
                    <button onClick={() => setGoalDirection('right')} disabled={isSubmitting} className={`px-4 py-2 rounded border ${goalDirection === 'right' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'} disabled:opacity-50 disabled:cursor-not-allowed`}>Shift Right (More Opposed: 6-10)</button>
                </div>
                {goalDirection && (<div className="text-center"><button onClick={handleStartDebate} disabled={isSubmitting} className="px-6 py-2 text-base font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait">{isSubmitting ? 'Starting...' : `Confirm & Start Debate (Goal: Shift ${goalDirection})`}</button></div>)}
                {startDebateMessage && <p className={`text-center text-sm mt-3 ${startDebateMessage.startsWith('Error:') ? 'text-red-600' : 'text-green-600'}`}>{startDebateMessage}</p>}
            </div>) : (<p className="mt-6 text-center text-red-600">Please <Link href="/login" className="underline font-semibold">log in</Link> to start a debate.</p>)}
        </div>
    );
}