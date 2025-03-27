'use client'; // This page will be interactive

import { useState, useEffect, FormEvent } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Topic, User, Argument, Debate } from '@prisma/client';

// --- Type Definitions (remain the same) ---
type DebateUser = Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl'>;
type TopicInfo = Pick<Topic, 'topicId' | 'name' | 'description'>;
interface ArgumentInfo extends Omit<Argument, 'debate' | 'user' | 'createdAt'> {
    createdAt: string;
    user: DebateUser | null;
}
// Add summaryArticle to FullDebateInfo type
interface FullDebateInfo extends Omit<Debate, 'topic' | 'user' | 'arguments' | 'createdAt' | 'completedAt'> {
    createdAt: string;
    completedAt: string | null;
    topic: TopicInfo;
    user: DebateUser;
    arguments: ArgumentInfo[];
    summaryArticle: string | null; // Add summary field
}


export default function DebatePage() {
    const params = useParams();
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
    const fetchDebate = async () => { /* ... unchanged fetchDebate logic ... */
        if (!loading) setLoading(true); setError(null);
        if (isNaN(debateId)) { setError("Invalid Debate ID format"); setLoading(false); return; }
        try { const response = await fetch(`/api/debates/${debateId}`); if (!response.ok) { let e = `HTTP error! status: ${response.status}`; try { const d = await response.json(); e = d.error || e; } catch { } if (response.status === 404) { notFound(); return; } throw new Error(e); } const data: FullDebateInfo = await response.json(); setDebate(data); } catch (err: unknown) { console.error("Fetch debate error:", err); setError(err instanceof Error ? err.message : "Failed to load debate"); } finally { setLoading(false); }
    };

    // Initial fetch
    useEffect(() => {
        if (debateIdStr) { fetchDebate(); } else { setError("Debate ID missing"); setLoading(false); } // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debateIdStr]);


    const handleArgumentSubmit = async (event: FormEvent<HTMLFormElement>) => { /* ... unchanged handleArgumentSubmit logic ... */
        event.preventDefault(); if (!currentArgument.trim() || isSubmitting || !debate || isNaN(debateId)) return; setIsSubmitting(true); setSubmitMessage('Submitting argument...'); try { const response = await fetch(`/api/debates/${debateId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ argumentText: currentArgument.trim() }), }); const data = await response.json(); if (!response.ok) { throw new Error(data.error || 'Failed to submit argument'); } setCurrentArgument(''); setSubmitMessage(''); await fetchDebate(); } catch (err: unknown) { console.error("Submit argument error:", err); setSubmitMessage(`Error: ${err instanceof Error ? err.message : 'Could not submit argument.'}`); } finally { setTimeout(() => setIsSubmitting(false), 300); }
    };

    if (loading || sessionStatus === 'loading') return <p className="text-center mt-10">Loading debate...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!debate) return <p className="text-center mt-10">Debate not found.</p>;

    // --- Calculation logic (remains the same) ---
    const latestArgument = debate.arguments[debate.arguments.length - 1];
    // Use finalStance if debate completed, otherwise calculate from last arg
    const currentStance = debate.status === 'completed' ? (debate.finalStance ?? debate.initialStance) : (latestArgument?.stanceAfter ?? debate.initialStance);
    const stancePercentage = currentStance * 10;
    const currentUserIdString = session?.user?.id;
    const isMyTurn = debate.status === 'active' && currentUserIdString === debate.user.userId.toString() && debate.turnCount % 2 === 0;
    const pointsFormatted = (debate.pointsEarned ?? 0).toFixed(1);
    const pointsClass = (debate.pointsEarned ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';


    return (
        <div>
            <h1 className="text-2xl font-bold mb-1">Debate: {debate.topic.name}</h1>
            <p className="text-sm text-gray-600 mb-1"> Started by: {debate.user.displayName || debate.user.username || 'User'} | Goal: Shift Stance {debate.goalDirection} | Status: <span className={`font-semibold ${debate.status === 'completed' ? 'text-green-700' : ''}`}>{debate.status}</span> </p>
            <p className={`text-sm font-semibold mb-4 ${pointsClass}`}> Points Earned: {parseFloat(pointsFormatted) >= 0 ? '+' : ''}{pointsFormatted} </p>

            {/* Stance Indicator */}
            <div className="mb-4 p-3 bg-gray-100 rounded">
                {/* ... unchanged stance indicator display ... */}
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Supportive (0)</span> <span>Neutral (5)</span> <span>Opposed (10)</span></div><div className="w-full bg-gradient-to-r from-green-300 via-yellow-300 to-red-300 h-4 rounded relative overflow-hidden border border-gray-300"><div className="absolute top-0 bottom-0 w-1 bg-black rounded shadow" style={{ left: `calc(${stancePercentage}% - 2px)` }} title={`Current Stance: ${currentStance.toFixed(1)}`}></div><div className="absolute top-0 bottom-0 w-px bg-gray-500 opacity-50" style={{ left: `${debate.initialStance * 10}%` }} title={`Initial Stance: ${debate.initialStance.toFixed(1)}`}></div></div><p className="text-center text-sm font-semibold mt-1"> {(debate.status === 'completed' ? 'Final' : 'Current')} AI Stance: {currentStance.toFixed(1)} / 10 </p>
            </div>

            {/* Argument History */}
            <div className="mb-6 border rounded p-4 bg-white h-96 overflow-y-auto"> {/* ... unchanged argument history display ... */}
                <h2 className="text-lg font-semibold mb-2">Arguments</h2> {debate.arguments.length === 0 ? <p className="text-gray-500 italic">No arguments yet.</p> : (<ul className="space-y-4">{debate.arguments.map(arg => (<li key={arg.argumentId} className="p-2 border-b"><p className="font-semibold text-sm">Turn {arg.turnNumber} ({arg.user?.displayName || 'User'}):</p><p className="whitespace-pre-wrap">{arg.argumentText}</p>{arg.aiResponse && (<div className="mt-2 p-2 bg-blue-50 rounded"><p className="font-semibold text-sm text-blue-800">AI Response:</p><p className="whitespace-pre-wrap text-sm">{arg.aiResponse}</p>{arg.stanceAfter != null && <p className="text-xs text-gray-500 mt-1">Stance changed from {arg.stanceBefore.toFixed(1)} to {arg.stanceAfter.toFixed(1)}. {arg.shiftReasoning}</p>}</div>)}<p className="text-xs text-gray-400 mt-1">Submitted: {new Date(arg.createdAt).toLocaleString()}</p></li>))}</ul>)}
            </div>

            {/* --- Conditional Display: Argument Input OR Summary --- */}
            {debate.status === 'active' && sessionStatus === 'authenticated' && (
                isMyTurn ? (<form onSubmit={handleArgumentSubmit} className="mt-4"> {/* ... unchanged form ... */} <label htmlFor="argumentInput" className="block text-sm font-medium text-gray-700 mb-1">Your Argument (Turn {debate.turnCount + 1} / {debate.maxTurns}):</label><textarea id="argumentInput" value={currentArgument} onChange={(e) => setCurrentArgument(e.target.value)} rows={4} required disabled={isSubmitting} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50" placeholder="Enter your argument here..." /><button type="submit" disabled={isSubmitting || !currentArgument.trim()} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">{isSubmitting ? 'Submitting...' : 'Submit Argument'}</button>{submitMessage && <p className={`text-sm mt-1 ${submitMessage.startsWith('Error:') ? 'text-red-600' : 'text-gray-600'}`}>{submitMessage}</p>} </form>)
                    : (<p className="text-center text-gray-600 italic mt-4">Waiting for AI response...</p>)
            )}

            {/* Display Summary if debate is completed and summary exists */}
            {(debate.status === 'completed' || debate.status === 'summary_failed') && debate.summaryArticle && (
                <div className="mt-6 p-4 border rounded bg-yellow-50">
                    <h2 className="text-xl font-semibold mb-3 text-center">Debate Summary</h2>
                    {/* Render summary content - preserving whitespace might be important */}
                    <p className="text-sm whitespace-pre-wrap">{debate.summaryArticle}</p>
                </div>
            )}

            {/* Display message if summary failed or pending */}
            {(debate.status === 'completed' || debate.status === 'summary_failed') && !debate.summaryArticle && (
                <p className="text-center italic text-gray-500 mt-4">Summary is being generated or failed...</p>
            )}

            {/* Display general status if not active and not showing summary */}
            {debate.status !== 'active' && !debate.summaryArticle && (
                <p className="text-center font-semibold mt-4">This debate is {debate.status}.</p>
            )}

            {/* Login prompt */}
            {sessionStatus === 'unauthenticated' && debate.status === 'active' && (
                <p className="text-center text-red-600 mt-4">Please <Link href="/login" className="underline">log in</Link> to participate.</p>
            )}
        </div>
    );
}