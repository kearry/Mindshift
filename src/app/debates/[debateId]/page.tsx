'use client'; // Needs state, effects, interaction

import { useState, useEffect, FormEvent, useCallback } from 'react'; // Added useCallback
import { useParams, notFound } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Topic, User, Argument, Debate, Comment } from '@prisma/client'; // Import Comment type

// --- Type Definitions ---
type DebateUser = Pick<User, 'userId' | 'username' | 'displayName' | 'profileImageUrl'>;
type TopicInfo = Pick<Topic, 'topicId' | 'name' | 'description'>;
interface ArgumentInfo extends Omit<Argument, 'debate' | 'user' | 'createdAt'> { createdAt: string; user: DebateUser | null; }
// Add Comment type for API response
interface CommentInfo extends Omit<Comment, 'debate' | 'user' | 'parent' | 'replies' | 'createdAt' | 'updatedAt'> {
    createdAt: string; // Date comes as string from JSON
    updatedAt: string | null;
    user: DebateUser; // User who commented
}
// Add comments and summaryArticle to FullDebateInfo
interface FullDebateInfo extends Omit<Debate, 'topic' | 'user' | 'arguments' | 'createdAt' | 'completedAt'> {
    createdAt: string; completedAt: string | null; topic: TopicInfo; user: DebateUser;
    arguments: ArgumentInfo[]; summaryArticle: string | null;
    // Comments might be fetched separately or included here depending on API design
}


export default function DebatePage() {
    const params = useParams();
    const { data: session, status: sessionStatus } = useSession();
    const [debate, setDebate] = useState<FullDebateInfo | null>(null);
    const [comments, setComments] = useState<CommentInfo[]>([]); // State for comments
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentArgument, setCurrentArgument] = useState('');
    const [isSubmittingArgument, setIsSubmittingArgument] = useState(false);
    const [argumentSubmitMessage, setArgumentSubmitMessage] = useState('');
    const [newCommentText, setNewCommentText] = useState(''); // State for new comment input
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentSubmitMessage, setCommentSubmitMessage] = useState('');


    const debateIdStr = Array.isArray(params.debateId) ? params.debateId[0] : params.debateId;
    const debateId = parseInt(debateIdStr ?? '', 10);

    // --- Data Fetching ---
    const fetchDebateAndComments = useCallback(async (fetchComments = true) => {
        // Only set loading true on initial full load
        if (!debate) setLoading(true);
        setError(null);

        if (isNaN(debateId)) { setError("Invalid Debate ID format"); setLoading(false); return; }

        try {
            // Fetch main debate data
            const debateResponse = await fetch(`/api/debates/${debateId}`);
            if (!debateResponse.ok) { let e = `HTTP error! status: ${debateResponse.status}`; try { const d = await debateResponse.json(); e = d.error || e; } catch { } if (debateResponse.status === 404) { notFound(); return; } throw new Error(e); }
            const debateData: FullDebateInfo = await debateResponse.json();
            setDebate(debateData);

            // Fetch comments if requested (e.g., on initial load or after posting)
            if (fetchComments) {
                const commentsResponse = await fetch(`/api/debates/${debateId}/comments`);
                if (!commentsResponse.ok) { throw new Error('Failed to fetch comments'); }
                const commentsData: CommentInfo[] = await commentsResponse.json();
                setComments(commentsData);
            }
        } catch (err: unknown) {
            console.error("Fetch debate/comments error:", err);
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
        // Add debateId to dependency array
    }, [debateId, debateIdStr, debate]); // Include debateId, debateIdStr, debate


    // Initial fetch for debate and comments
    useEffect(() => {
        if (debateIdStr) { fetchDebateAndComments(true); } else { setError("Debate ID missing"); setLoading(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debateIdStr]); // Trigger only when ID changes


    // --- Handlers ---
    const handleArgumentSubmit = async (event: FormEvent<HTMLFormElement>) => { /* ... unchanged ... */
        event.preventDefault(); if (!currentArgument.trim() || isSubmittingArgument || !debate || isNaN(debateId)) return; setIsSubmittingArgument(true); setArgumentSubmitMessage('Submitting argument...'); try { const response = await fetch(`/api/debates/${debateId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ argumentText: currentArgument.trim() }), }); const data = await response.json(); if (!response.ok) { throw new Error(data.error || 'Failed to submit argument'); } setCurrentArgument(''); setArgumentSubmitMessage(''); await fetchDebateAndComments(true); } catch (err: unknown) { console.error("Submit argument error:", err); setArgumentSubmitMessage(`Error: ${err instanceof Error ? err.message : 'Could not submit argument.'}`); } finally { setTimeout(() => setIsSubmittingArgument(false), 300); }
    };

    const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newCommentText.trim() || isSubmittingComment || isNaN(debateId)) return;

        setIsSubmittingComment(true);
        setCommentSubmitMessage('');

        try {
            const response = await fetch(`/api/debates/${debateId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentText: newCommentText.trim() /*, parentId: null */ }), // Add parentId if implementing replies
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.error || 'Failed to post comment'); }

            // Success
            setNewCommentText(''); // Clear input
            // Refresh comments list
            await fetchDebateAndComments(true); // Re-fetch debate and comments
            // Or optimistically add comment: setComments(prev => [...prev, data]);

        } catch (err: unknown) {
            console.error("Submit comment error:", err);
            setCommentSubmitMessage(`Error: ${err instanceof Error ? err.message : 'Could not post comment.'}`);
        } finally {
            setIsSubmittingComment(false);
        }
    };


    // --- Rendering ---
    if (loading || sessionStatus === 'loading') return <p className="text-center mt-10">Loading debate...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">Error: {error}</p>;
    if (!debate) return <p className="text-center mt-10">Debate not found.</p>;

    // --- Calculation logic (remains the same) ---
    const latestArgument = debate.arguments[debate.arguments.length - 1]; const currentStance = debate.status === 'completed' ? (debate.finalStance ?? debate.initialStance) : (latestArgument?.stanceAfter ?? debate.initialStance); const stancePercentage = currentStance * 10; const currentUserIdString = session?.user?.id; const isMyTurn = debate.status === 'active' && currentUserIdString === debate.user.userId.toString() && debate.turnCount % 2 === 0; const pointsFormatted = (debate.pointsEarned ?? 0).toFixed(1); const pointsClass = (debate.pointsEarned ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';

    return (
        <div>
            {/* --- Debate Info Header (unchanged) --- */}
            <h1 className="text-2xl font-bold mb-1">Debate: {debate.topic.name}</h1>
            <p className="text-sm text-gray-600 mb-1"> Started by: {debate.user.displayName || debate.user.username || 'User'} | Goal: Shift Stance {debate.goalDirection} | Status: <span className={`font-semibold ${debate.status === 'completed' ? 'text-green-700' : ''}`}>{debate.status}</span> </p>
            <p className={`text-sm font-semibold mb-4 ${pointsClass}`}> Points Earned: {parseFloat(pointsFormatted) >= 0 ? '+' : ''}{pointsFormatted} </p>

            {/* --- Stance Indicator (unchanged) --- */}
            <div className="mb-4 p-3 bg-gray-100 rounded"> <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Supportive (0)</span> <span>Neutral (5)</span> <span>Opposed (10)</span></div><div className="w-full bg-gradient-to-r from-green-300 via-yellow-300 to-red-300 h-4 rounded relative overflow-hidden border border-gray-300"><div className="absolute top-0 bottom-0 w-1 bg-black rounded shadow" style={{ left: `calc(${stancePercentage}% - 2px)` }} title={`Current Stance: ${currentStance.toFixed(1)}`}></div><div className="absolute top-0 bottom-0 w-px bg-gray-500 opacity-50" style={{ left: `${debate.initialStance * 10}%` }} title={`Initial Stance: ${debate.initialStance.toFixed(1)}`}></div></div><p className="text-center text-sm font-semibold mt-1"> {(debate.status === 'completed' ? 'Final' : 'Current')} AI Stance: {currentStance.toFixed(1)} / 10 </p> </div>

            {/* --- Argument History (unchanged) --- */}
            <div className="mb-6 border rounded p-4 bg-white h-96 overflow-y-auto"> <h2 className="text-lg font-semibold mb-2">Arguments</h2> {debate.arguments.length === 0 ? <p className="text-gray-500 italic">No arguments yet.</p> : (<ul className="space-y-4">{debate.arguments.map(arg => (<li key={arg.argumentId} className="p-2 border-b"><p className="font-semibold text-sm">Turn {arg.turnNumber} ({arg.user?.displayName || 'User'}):</p><p className="whitespace-pre-wrap">{arg.argumentText}</p>{arg.aiResponse && (<div className="mt-2 p-2 bg-blue-50 rounded"><p className="font-semibold text-sm text-blue-800">AI Response:</p><p className="whitespace-pre-wrap text-sm">{arg.aiResponse}</p>{arg.stanceAfter != null && <p className="text-xs text-gray-500 mt-1">Stance changed from {arg.stanceBefore.toFixed(1)} to {arg.stanceAfter.toFixed(1)}. {arg.shiftReasoning}</p>}</div>)}<p className="text-xs text-gray-400 mt-1">Submitted: {new Date(arg.createdAt).toLocaleString()}</p></li>))}</ul>)} </div>

            {/* --- Argument Input / Waiting Message (unchanged) --- */}
            {debate.status === 'active' && sessionStatus === 'authenticated' && (isMyTurn ? (<form onSubmit={handleArgumentSubmit} className="mt-4"> <label htmlFor="argumentInput" className="block text-sm font-medium text-gray-700 mb-1">Your Argument (Turn {debate.turnCount + 1} / {debate.maxTurns}):</label><textarea id="argumentInput" value={currentArgument} onChange={(e) => setCurrentArgument(e.target.value)} rows={4} required disabled={isSubmittingArgument} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50" placeholder="Enter your argument here..." /><button type="submit" disabled={isSubmittingArgument || !currentArgument.trim()} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">{isSubmittingArgument ? 'Submitting...' : 'Submit Argument'}</button>{argumentSubmitMessage && <p className={`text-sm mt-1 ${argumentSubmitMessage.startsWith('Error:') ? 'text-red-600' : 'text-gray-600'}`}>{argumentSubmitMessage}</p>} </form>) : (<p className="text-center text-gray-600 italic mt-4">Waiting for AI response...</p>))}

            {/* --- Debate Summary Display (unchanged) --- */}
            {(debate.status === 'completed' || debate.status === 'summary_failed') && debate.summaryArticle && (<div className="mt-6 p-4 border rounded bg-yellow-50"> <h2 className="text-xl font-semibold mb-3 text-center">Debate Summary</h2> <p className="text-sm whitespace-pre-wrap">{debate.summaryArticle}</p> </div>)}
            {(debate.status === 'completed' || debate.status === 'summary_failed') && !debate.summaryArticle && (<p className="text-center italic text-gray-500 mt-4">Summary is being generated or failed...</p>)}

            {/* --- NEW: Comments Section --- */}
            <div className="mt-8 pt-6 border-t">
                <h2 className="text-xl font-semibold mb-4">Comments</h2>
                {/* Display Existing Comments */}
                <div className="mb-6 space-y-4">
                    {comments.length === 0 ? (
                        <p className="text-gray-500 italic">No comments yet.</p>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.commentId} className="p-3 border rounded bg-white shadow-sm">
                                <div className="flex items-center mb-1 space-x-2">
                                    {/* Placeholder avatar */}
                                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 text-xs shrink-0">?</div>
                                    <Link href={`/profile/${comment.user.userId}`} className="text-sm font-semibold text-indigo-700 hover:underline">
                                        {comment.user.displayName || comment.user.username}
                                    </Link>
                                    <span className="text-xs text-gray-400"> {new Date(comment.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.commentText}</p>
                                {/* TODO: Add Reply button/functionality */}
                            </div>
                        ))
                    )}
                </div>

                {/* Add New Comment Form (Show if logged in) */}
                {sessionStatus === 'authenticated' ? (
                    <form onSubmit={handleCommentSubmit} className="mt-4">
                        <label htmlFor="commentText" className="block text-sm font-medium text-gray-700 mb-1">Add a comment:</label>
                        <textarea
                            id="commentText"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            rows={3}
                            required
                            disabled={isSubmittingComment}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                            placeholder="Share your thoughts..."
                        />
                        <button
                            type="submit"
                            disabled={isSubmittingComment || !newCommentText.trim()}
                            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                        </button>
                        {commentSubmitMessage && <p className="text-sm text-red-600 mt-1">{commentSubmitMessage}</p>}
                    </form>
                ) : (
                    <p className="text-center text-gray-500 mt-4">You must be <Link href="/login" className="underline text-indigo-600">logged in</Link> to comment.</p>
                )}
            </div>
            {/* --- End Comments Section --- */}


            {/* General status/login messages (slight adjustment) */}
            {debate.status !== 'active' && !debate.summaryArticle && (<p className="text-center font-semibold mt-4">This debate is {debate.status}.</p>)}
            {sessionStatus === 'unauthenticated' && debate.status === 'active' && (<p className="text-center text-red-600 mt-4">Please <Link href="/login" className="underline">log in</Link> to participate.</p>)}
        </div>
    );
}