import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { CommentInfo } from '@/app/debates/[debateId]/page';

interface Props {
    comments: CommentInfo[];
    debateId: number;
    sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
    onCommentSubmitted: () => void;
}

export default function CommentSection({ comments, debateId, sessionStatus, onCommentSubmitted }: Props) {
    const [newCommentText, setNewCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentSubmitMessage, setCommentSubmitMessage] = useState('');

    const handleCommentSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newCommentText.trim() || isSubmittingComment || isNaN(debateId)) return;

        setIsSubmittingComment(true);
        setCommentSubmitMessage('');

        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/debates/${debateId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentText: newCommentText.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to post comment');
            }

            setNewCommentText('');
            onCommentSubmitted();
        } catch (err: unknown) {
            console.error("Submit comment error:", err);
            setCommentSubmitMessage(`Error: ${err instanceof Error ? err.message : 'Could not post comment.'}`);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    return (
        <div className="mt-8 pt-6 border-t">
            <h2 className="text-xl font-semibold mb-4">Comments</h2>
            <div className="mb-6 space-y-4">
                {comments.length === 0 ? (
                    <p className="text-gray-500 italic">No comments yet.</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.commentId} className="p-3 border rounded bg-white shadow-sm">
                            <div className="flex items-center mb-1 space-x-2">
                                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 text-xs shrink-0">?</div>
                                <Link href={`/profile/${comment.user.userId}`} className="text-sm font-semibold text-indigo-700 hover:underline">
                                    {comment.user.displayName || comment.user.username}
                                </Link>
                                <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.commentText}</p>
                        </div>
                    ))
                )}
            </div>
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
                <p className="text-center text-gray-500 mt-4">
                    You must be <Link href="/login" className="underline text-indigo-600">logged in</Link> to comment.
                </p>
            )}
        </div>
    );
}