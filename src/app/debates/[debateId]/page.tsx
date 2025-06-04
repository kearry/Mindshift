// src/app/debates/[debateId]/page.tsx

// ****** THIS MUST BE THE VERY FIRST LINE ******
'use client';
// ****** NO COMMENTS OR EMPTY LINES ABOVE ******

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown'; // Use correct import
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import LLMSelector from '@/components/LLMSelector';
import { useLLMSettings } from '@/components/LLMSettingsContext';
import type { Pluggable } from 'unified'; // Import Pluggable type for plugins
// --- Define expected data structure (Helper Types) ---
type UserSnippet = {
    userId: number;
    username?: string | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
};
type TopicSnippet = {
    topicId: number;
    name: string;
    description?: string | null;
};
type ArgumentWithUser = {
    argumentId: number;
    turnNumber: number;
    argumentText: string;
    aiResponse?: string | null;
    stanceBefore: number;
    stanceAfter?: number | null;
    shiftReasoning?: string | null;
    user?: UserSnippet | null; // User who made the argument
    createdAt: string; // Dates as strings from JSON
};
type CommentWithUser = {
    commentId: number;
    commentText: string;
    createdAt: string; // Dates as strings from JSON
    userId: number;
    debateId: number;
    parentId?: number | null;
    user: UserSnippet; // User who wrote the comment
};
// Type matching the GET /api/debates/[debateId] response
type DebateWithRelations = {
    debateId: number;
    topic: TopicSnippet;
    user: UserSnippet; // The owner/debater
    arguments: ArgumentWithUser[];
    initialStance: number;
    finalStance?: number | null;
    goalDirection: 'left' | 'right';
    status: string;
    pointsEarned: number | null;
    summaryArticle?: string | null;
    createdAt: string; // Dates as strings from JSON
    completedAt?: string | null; // Dates as strings from JSON
    turnCount: number; // Current turn count
    maxTurns: number; // Max turns per side
    llmProvider?: 'openai' | 'ollama' | null;
    llmModel?: string | null;
};
// --- End of Helper Types ---


// --- Main Component ---
export default function DebatePage() {
    // --- State Variables ---
    const [debate, setDebate] = useState<DebateWithRelations | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [comments, setComments] = useState<CommentWithUser[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [newCommentText, setNewCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [newArgumentText, setNewArgumentText] = useState('');
    const [isSubmittingArgument, setIsSubmittingArgument] = useState(false);
    const [argumentError, setArgumentError] = useState<string | null>(null);
    const { provider, model } = useLLMSettings();
    const [selectedProvider, setSelectedProvider] = useState<'openai' | 'ollama'>(provider);
    const [selectedModel, setSelectedModel] = useState<string>(model);

    const handleModelSelect = (provider: 'openai' | 'ollama', model: string) => {
        setSelectedProvider(provider);
        setSelectedModel(model);
    };


    // --- Hooks ---
    const params = useParams();
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const debateId = params?.debateId as string;

    // --- Data Fetching Function ---
    const fetchDebateAndComments = useCallback(async (showLoading: boolean = false) => {
        if (!debateId) {
            setError("Debate ID is missing in the URL.");
            setLoading(false); setLoadingComments(false); return;
        }
        // Reset states before fetching
        if (showLoading) {
            setLoading(true);
        }
        setLoadingComments(true);
        setError(null); setCommentError(null); setArgumentError(null);

        try {
            // Fetch debate details
            const debateResponse = await fetch(`/api/debates/${debateId}`);
            if (!debateResponse.ok) {
                const errorData = await debateResponse.json();
                throw new Error(errorData.error || `Failed to fetch debate (Status: ${debateResponse.status})`);
            }
            const debateData: DebateWithRelations = await debateResponse.json();
            setDebate(debateData);
            setSelectedProvider((debateData.llmProvider as 'openai' | 'ollama') ?? 'openai');
            setSelectedModel(debateData.llmModel ?? 'gpt-4o-mini');

            // Fetch comments
            const commentsResponse = await fetch(`/api/debates/${debateId}/comments`);
            if (!commentsResponse.ok) {
                const errorData = await commentsResponse.json();
                setCommentError(errorData.error || `Failed to fetch comments (Status: ${commentsResponse.status})`);
                setComments([]); // Ensure comments are empty if fetch fails
            } else {
                const commentsData: CommentWithUser[] = await commentsResponse.json();
                setComments(commentsData);
            }

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during data fetching.';
            setError(errorMessage); console.error("Error fetching data:", err);
            setDebate(null); setComments([]); // Clear data on error
        } finally {
            setLoading(false);
            setLoadingComments(false);
        }
    }, [debateId]);

    // Poll for updates while debate is active
    useEffect(() => {
        if (debate?.status !== 'active') return;

        const refreshInterval = setInterval(() => {
            // Only refresh debate data, not comments to reduce load
            fetchDebateAndComments(false);
        }, 10000); // Check every 10 seconds

        return () => clearInterval(refreshInterval);
    }, [debate?.status, fetchDebateAndComments]);

    // --- Data Fetching Effects ---
    useEffect(() => {
        // Fetch data when the component mounts or debateId changes
        fetchDebateAndComments(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debateId]); // Dependency array ensures fetch runs on ID change


    // --- Delete Debate Function ---
    const handleDeleteDebate = async () => {
        // Ensure debate data and user session exist
        if (!debate || !session?.user?.id) {
            setError("Cannot delete: Debate data missing or not logged in.");
            return;
        }
        // Verify ownership before prompting
        const loggedInUserIdCheck = session.user.id ? parseInt(session.user.id, 10) : null;
        if (loggedInUserIdCheck !== debate.user.userId) {
            alert("You are not authorized to delete this debate.");
            return; // Prevent deletion if not owner
        }
        // Confirm deletion with the user
        const confirmation = window.confirm('Are you sure you want to permanently delete this debate and all its content? This action cannot be undone.');
        if (!confirmation) {
            return; // Stop if user cancels
        }
        // Set loading/error states
        setIsDeleting(true);
        setError(null);
        try {
            // Make DELETE request to the API
            const response = await fetch(`/api/debates/${debate.debateId}`, { method: 'DELETE' });
            if (!response.ok) {
                // Handle API errors
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete debate (Status: ${response.status})`);
            }
            // On success
            alert('Debate successfully deleted.');
            router.push(`/profile/${session.user.id}`); // Redirect after deletion (e.g., to profile)
        } catch (err: unknown) {
            // Handle fetch/network errors or errors thrown from response check
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during deletion.';
            setError(`Deletion failed: ${errorMessage}`);
            console.error("Error deleting debate:", err);
        } finally {
            setIsDeleting(false); // Reset loading state
        }
    };

    // --- Comment Submission Function ---
    const handleCommentSubmit = async (event: FormEvent) => {
        event.preventDefault(); // Prevent page reload
        // Basic validation
        if (!newCommentText.trim()) { setCommentError("Comment cannot be empty."); return; }
        if (!session?.user?.id) { setCommentError("You must be logged in to comment."); return; }
        // Set loading/error states
        setIsSubmittingComment(true);
        setCommentError(null);
        try {
            // Make POST request to the comments API endpoint
            const response = await fetch(`/api/debates/${debateId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentText: newCommentText.trim() }),
            });
            if (!response.ok) {
                // Handle API errors
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to post comment (Status: ${response.status})`);
            }
            // On success, add the new comment to the top of the list and clear input
            const postedComment: CommentWithUser = await response.json();
            setComments(prevComments => [postedComment, ...prevComments]);
            setNewCommentText('');
        } catch (err: unknown) {
            // Handle fetch/network errors or errors thrown from response check
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while posting comment.';
            setCommentError(`Failed to post comment: ${errorMessage}`);
            console.error("Error posting comment:", err);
        } finally {
            setIsSubmittingComment(false); // Reset loading state
        }
    };

    // --- Argument Submission Function ---
    const handleArgumentSubmit = async (event: FormEvent) => {
        event.preventDefault(); // Prevent page reload
        // Basic validation and turn check
        if (!newArgumentText.trim()) { setArgumentError("Argument cannot be empty."); return; }
        // Ensure debate exists before accessing properties
        if (!session?.user?.id || !debate || parseInt(session.user.id, 10) !== debate.user.userId) {
            setArgumentError("Cannot submit argument: Not logged in or not your debate turn.");
            return;
        }
        // Set loading/error states
        setIsSubmittingArgument(true);
        setArgumentError(null);
        try {
            // Make POST request to the main debate API endpoint
            const response = await fetch(`/api/debates/${debateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    argumentText: newArgumentText.trim(),
                    llmProvider: selectedProvider,
                    llmModel: selectedModel
                }),
            });
            if (!response.ok) {
                // Handle API errors
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to submit argument (Status: ${response.status})`);
            }
            // On success, clear input and re-fetch all data to show updates
            console.log("Argument submitted, refreshing debate data...");
            setNewArgumentText('');
            await fetchDebateAndComments(false); // Re-fetch is simplest way to update UI without scroll reset
        } catch (err: unknown) {
            // Handle fetch/network errors or errors thrown from response check
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while submitting argument.';
            setArgumentError(`Failed to submit argument: ${errorMessage}`);
            console.error("Error submitting argument:", err);
        } finally {
            setIsSubmittingArgument(false); // Reset loading state
        }
    };


    // --- Render Logic ---
    // Show loading state
    if (loading || sessionStatus === 'loading') {
        return <div className="container mx-auto p-4 text-center">Loading debate details...</div>;
    }
    // Show error or not found state (ensures 'debate' is not null below)
    if (error || !debate) {
        return <div className="container mx-auto p-4 text-center text-red-500">Error: {error || 'Debate not found or failed to load.'}</div>;
    }

    // Calculate flags *after* confirming debate is not null
    const loggedInUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
    const isOwner = loggedInUserId === debate.user.userId; // Safe access
    // *** Use Corrected Turn Logic ***
    const canSubmitArgument = debate.status === 'active' &&
        isOwner &&
        debate.turnCount % 2 === 0 && // User turn is when turnCount is EVEN
        debate.turnCount < (debate.maxTurns * 2); // Check max turns

    // --- Main Page Content ---
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            {/* Debate Header */}
            <div className="mb-6 border-b pb-4">
                {/* Link back to the topic page */}
                <Link href={`/topics/${debate.topic.topicId}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                    ← Back to Topic: {debate.topic.name}
                </Link>
                {/* Debate Title and Info */}
                <h1 className="text-3xl md:text-4xl font-bold mt-2 mb-1">Debate #{debate.debateId}</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-1"> Topic: <span className="font-medium">{debate.topic.name}</span> </p>
                <p className="text-gray-600 dark:text-gray-400 mb-1"> Debater: {debate.user?.displayName || debate.user?.username || 'Unknown User'} </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-2"> Started On: {new Date(debate.createdAt).toLocaleDateString()} </p>
                {/* Status Badge */}
                <p className="mb-1"> Status: <span className={`font-semibold px-2 py-1 rounded text-sm ${debate.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : debate.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                    {debate.status.replace('_', ' ')}
                </span>
                </p>
                {/* Turn Counter */}
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-2"> Turns Taken: {Math.floor(debate.turnCount / 2)} / {debate.maxTurns} </p>
                {/* Points Display */}
                {debate.status === 'completed' && debate.pointsEarned !== null && (
                    <p className="text-lg font-medium">Points Earned: {debate.pointsEarned.toFixed(1)}</p>
                )}
            </div>

            {/* Delete Button (Conditional) */}
            {isOwner && (
                <div className="my-6 p-4 border border-red-300 rounded bg-red-50 dark:bg-gray-800 dark:border-red-700">
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Admin Action</h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mb-3">As the owner, you can permanently delete this debate.</p>
                    {/* Delete Button */}
                    <button onClick={handleDeleteDebate} disabled={isDeleting}
                        className={`px-4 py-2 rounded font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${isDeleting ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800'
                            }`}>
                        {isDeleting ? 'Deleting...' : 'Delete This Debate'}
                    </button>
                    {/* Display deletion specific error */}
                    {error && error.startsWith('Deletion failed:') && (
                        <p className="text-red-600 mt-2 text-sm">{error}</p>
                    )}
                </div>
            )}

            {/* Section to Display Arguments */}
            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Debate Flow</h2>
                {/* Check if arguments array exists and has items */}
                {debate.arguments && debate.arguments.length > 0 ? (
                    <div className="space-y-5">
                        {/* Map over arguments to display each turn */}
                        {debate.arguments.map(arg => (
                            <div key={arg.argumentId} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
                                {/* User Argument Part */}
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Turn {Math.ceil(arg.turnNumber / 2)} - {arg.user?.displayName || arg.user?.username || 'User'}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({new Date(arg.createdAt).toLocaleTimeString()})</span>
                                </p>
                                <p className="mt-1 mb-2 text-gray-800 dark:text-gray-200">{arg.argumentText}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">AI Stance Before: {arg.stanceBefore.toFixed(1)}/10</p>

                                {/* AI Response Part (Conditional) */}
                                {arg.aiResponse && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">AI Response</p>
                                        {/* Render AI response using Markdown */}
                                        <div className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-300 mt-1">
                                            <ReactMarkdown remarkPlugins={[remarkGfm] as Pluggable[]}>
                                                {arg.aiResponse}
                                            </ReactMarkdown>
                                        </div>
                                        {/* Display stance change and reasoning */}
                                        {arg.stanceAfter !== null && arg.stanceAfter !== undefined && (
                                            <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                                                AI Stance After: {arg.stanceAfter.toFixed(1)}/10 (Shift: {(arg.stanceAfter - arg.stanceBefore).toFixed(1)})
                                            </p>
                                        )}
                                        {arg.shiftReasoning && (
                                            <p className="text-xs mt-1 italic text-gray-500 dark:text-gray-400">
                                                Reasoning: {arg.shiftReasoning}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {/* Indicate if waiting for AI response */}
                                {!arg.aiResponse && arg.turnNumber % 2 !== 0 && debate.status === 'active' && debate.turnCount === arg.turnNumber && (
                                    <p className="text-sm italic text-gray-500 dark:text-gray-400 mt-2">Processing AI response...</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // Message if no arguments yet
                    <p className="text-gray-500 dark:text-gray-400">No arguments have been made yet.</p>
                )}
            </div>

            {/* Section for User to Submit Next Argument (Conditional) */}
            {canSubmitArgument && (
                <div className="mb-8 p-4 border rounded-lg shadow dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {/* Form Heading */}
                    <h2 className="text-2xl font-semibold mb-4">Your Turn (Turn {Math.floor(debate.turnCount / 2) + 1})</h2>
                    {/* Argument Submission Form */}
                    <form onSubmit={handleArgumentSubmit}>
                        <LLMSelector
                            onModelSelect={handleModelSelect}
                            defaultProvider={selectedProvider}
                            defaultModel={selectedModel}
                        />
                        <label htmlFor="argumentText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Enter your argument </label>
                        <textarea id="argumentText" rows={5}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            placeholder="Present your case..." value={newArgumentText} onChange={(e) => setNewArgumentText(e.target.value)} disabled={isSubmittingArgument} />
                        {/* Display argument submission error */}
                        {argumentError && <p className="text-red-500 text-sm mt-1">{argumentError}</p>}
                        {/* Submit Button */}
                        <button type="submit" disabled={isSubmittingArgument || !newArgumentText.trim()}
                            className={`mt-3 px-5 py-2 rounded font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${isSubmittingArgument || !newArgumentText.trim() ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-offset-gray-900'
                                }`}>
                            {isSubmittingArgument ? 'Submitting...' : 'Submit Argument'}
                        </button>
                    </form>
                </div>
            )}
            {/* Show message if debate is over */}
            {debate.status !== 'active' && (
                <div className="mb-8 p-4 border rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700 text-center">
                    <p className="font-semibold text-gray-700 dark:text-gray-300"> This debate has concluded. </p>
                </div>
            )}

            {/* Section to Display Summary (Conditional) */}
            {debate.status === 'completed' && debate.summaryArticle && (
                <div className="mb-8 p-4 border rounded-lg shadow-sm dark:border-gray-700 bg-white dark:bg-gray-800">
                    <h2 className="text-2xl font-semibold mb-4">Debate Summary</h2>
                    {/* Render summary using Markdown */}
                    <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm] as Pluggable[]}>
                            {debate.summaryArticle}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
            {/* Message if summary failed */}
            {debate.status === 'summary_failed' && (
                <div className="mb-8 p-4 border border-yellow-300 rounded bg-yellow-50 dark:bg-gray-800 dark:border-yellow-600">
                    <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Summary Status</h2>
                    <p className="text-yellow-700 dark:text-yellow-400">The automatic summary generation failed for this debate.</p>
                </div>
            )}

            {/* Comments Section */}
            <div className="mt-8 border-t pt-6 dark:border-gray-700">
                <h2 className="text-2xl font-semibold mb-4">Comments ({comments.length})</h2>
                {/* Comment Submission Form (Conditional) */}
                {sessionStatus === 'authenticated' && session?.user && (
                    <form onSubmit={handleCommentSubmit} className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                        <label htmlFor="commentText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Add your comment </label>
                        <textarea id="commentText" rows={3}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
                            placeholder="Share your thoughts..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} disabled={isSubmittingComment} />
                        {/* Display comment submission error */}
                        {commentError && <p className="text-red-500 text-sm mt-1">{commentError}</p>}
                        {/* Submit button */}
                        <button type="submit" disabled={isSubmittingComment || !newCommentText.trim()}
                            className={`mt-2 px-4 py-2 rounded font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${isSubmittingComment || !newCommentText.trim() ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 dark:focus:ring-offset-gray-900'
                                }`}>
                            {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                        </button>
                    </form>
                )}
                {/* Login prompt */}
                {sessionStatus === 'unauthenticated' && (
                    <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
                        Please{' '}
                        <Link href="/api/auth/signin" className="text-indigo-600 hover:underline dark:text-indigo-400">
                            sign in
                        </Link>
                        {' '}to post comments.
                    </p>
                )}
                {/* Display Existing Comments */}
                {/* Loading indicator */}
                {loadingComments && <p className="text-gray-500 dark:text-gray-400">Loading comments...</p>}
                {/* Error message for loading comments */}
                {!loadingComments && commentError && !commentError.startsWith('Failed to post') && (
                    <p className="text-red-500">Error loading comments: {commentError}</p>
                )}
                {/* Message if no comments */}
                {!loadingComments && comments.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400">No comments yet. Be the first to share your thoughts!</p>
                )}
                {/* List of comments */}
                {!loadingComments && comments.length > 0 && (
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <div key={comment.commentId} className="p-3 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
                                <div className="flex items-center mb-1">
                                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                        {comment.user.displayName || comment.user.username || 'Anonymous'}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        - {new Date(comment.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300">{comment.commentText}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div> // End main container div
    ); // End return
} // End component