'use client'; // This page will be interactive

import { useState, useEffect, FormEvent } from 'react';
// Comment out useRouter import again as it's currently unused
import { useParams, notFound /*, useRouter */ } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Topic, User, Argument, Debate } from '@prisma/client'; // Import full types

// Define types using 'type' aliases with Pick
type DebateUser = Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl'>;
type TopicInfo = Pick<Topic, 'topicId' | 'name' | 'description'>;

// Other interfaces remain the same
interface ArgumentInfo extends Omit<Argument, 'debate' | 'user' | 'createdAt'> {
    createdAt: string;
    user: DebateUser | null;
}
interface FullDebateInfo extends Omit<Debate, 'topic' | 'user' | 'arguments' | 'createdAt' | 'completedAt'> {
    createdAt: string;
    completedAt: string | null;
    topic: TopicInfo;
    user: DebateUser;
    arguments: ArgumentInfo[];
}


export default function DebatePage() {
    const params = useParams();
    // const router = useRouter(); // Comment out unused router hook
    const { data: session, status: sessionStatus } = useSession();
    const [debate, setDebate] = useState<FullDebateInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentArgument, setCurrentArgument] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');

    const debateIdStr = Array.isArray(params.debateId) ? params.debateId[0] : params.debateId;
    const debateId = parseInt(debateIdStr ?? '', 10);

    // Function to fetch debate data
    const fetchDebate = async () => {
        if (!loading) setLoading(true); // Set loading only if not already loading
        setError(null);

        if (isNaN(debateId)) {
            setError("Invalid Debate ID format"); setLoading(false); return;
        }

        try {
            const response = await fetch(`/api/debates/${debateId}`);
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch { /* Ignore */ }
                if (response.status === 404) { notFound(); return; }
                throw new Error(errorMsg);
            }
            const data: FullDebateInfo = await response.json();
            setDebate(data);
        } catch (err: unknown) {
            console.error("Fetch debate error:", err);
            setError(err instanceof Error ? err.message : "Failed to load debate");
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        if (debateIdStr) {
            fetchDebate();
        } else {
            setError("Debate ID missing"); setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debateIdStr]);


    const handleArgumentSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentArgument.trim() || isSubmitting || !debate || isNaN(debateId)) return;

        setIsSubmitting(true);
        setSubmitMessage('Submitting argument...');

        try {
            const response = await fetch(`/api/debates/${debateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ argumentText: currentArgument.trim() }),
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.error || 'Failed to submit argument'); }

            setSubmitMessage('Argument saved. Waiting for AI response...');
            setCurrentArgument('');
            // Refresh data to show the new argument
            await fetchDebate();
            // --- TODO: Uncomment router logic when AI response triggers redirect ---
            // router.push(`/debates/${debate.debateId}`); // Or maybe just stay?

        } catch (err: unknown) {
            console.error("Submit argument error:", err)
            setSubmitMessage(`Error: ${err instanceof Error ? err.message : 'Could not submit argument.'}`);
        } finally {
            setTimeout(() => setIsSubmitting(false), 300);
        }
    };


    if (loading || sessionStatus === 'loading') return <p className="text-center mt-10">Loading debate...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!debate) return <p className="text-center mt-10">Debate not found.</p>;

    const currentUserIdString = session?.user?.id;
    // Use debate.turnCount from fetched data
    const isMyTurn = debate.status === 'active' && currentUserIdString === debate.user.userId.toString() && debate.turnCount % 2 === 0;

    return (
        <div>
            <h1 className="text-2xl font-bold mb-1">Debate: {debate.topic.name}</h1>
            <p className="text-sm text-gray-600 mb-4">
                Started by: {debate.user.displayName || debate.user.username || 'User'} |
                Your Goal: Shift Stance {debate.goalDirection} | Status: {debate.status}
            </p>
            <div className="mb-4 p-2 bg-gray-100 rounded text-center">
                <p>Current Stance: [Placeholder Visualization] - Initial: {debate.initialStance}/10</p>
                <p className="text-xs">(0 = Fully Supportive, 10 = Fully Opposed)</p>
            </div>
            <div className="mb-6 border rounded p-4 bg-white h-96 overflow-y-auto">
                <h2 className="text-lg font-semibold mb-2">Arguments</h2>
                {debate.arguments.length === 0 ? <p className="text-gray-500 italic">No arguments yet.</p> : (
                    <ul className="space-y-4">
                        {debate.arguments.map(arg => (
                            <li key={arg.argumentId} className="p-2 border-b">
                                <p className="font-semibold text-sm">Turn {arg.turnNumber} ({arg.user?.displayName || 'User'}):</p>
                                <p className="whitespace-pre-wrap">{arg.argumentText}</p>
                                {arg.aiResponse && (<div className="mt-2 p-2 bg-blue-50 rounded">
                                    <p className="font-semibold text-sm text-blue-800">AI Response:</p>
                                    <p className="whitespace-pre-wrap text-sm">{arg.aiResponse}</p>
                                    {arg.stanceAfter != null && <p className="text-xs text-gray-500 mt-1">Stance changed from {arg.stanceBefore} to {arg.stanceAfter}. {arg.shiftReasoning}</p>}
                                </div>)}
                                <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(arg.createdAt).toLocaleString()}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {debate.status === 'active' && sessionStatus === 'authenticated' && (
                isMyTurn ? (<form onSubmit={handleArgumentSubmit} className="mt-4">
                    <label htmlFor="argumentInput" className="block text-sm font-medium text-gray-700 mb-1">Your Argument (Turn {debate.turnCount + 1} / {debate.maxTurns}):</label>
                    <textarea id="argumentInput" value={currentArgument} onChange={(e) => setCurrentArgument(e.target.value)} rows={4} required disabled={isSubmitting} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50" placeholder="Enter your argument here..." />
                    <button type="submit" disabled={isSubmitting || !currentArgument.trim()} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">{isSubmitting ? 'Submitting...' : 'Submit Argument'}</button>
                    {submitMessage && <p className="text-sm text-red-600 mt-1">{submitMessage}</p>}
                </form>) : (<p className="text-center text-gray-600 italic mt-4">Waiting for AI response...</p>)
            )}
            {debate.status !== 'active' && <p className="text-center font-semibold mt-4">This debate is {debate.status}.</p>}
            {sessionStatus === 'unauthenticated' && <p className="text-center text-red-600 mt-4">Please <Link href="/login" className="underline">log in</Link> to participate.</p>}
        </div>
    );
}