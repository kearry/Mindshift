import { useState, FormEvent } from 'react';
import Link from 'next/link';

interface Props {
    isMyTurn: boolean;
    debateId: number;
    turnCount: number;
    maxTurns: number;
    onArgumentSubmitted: () => void;
    sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
}

export default function ArgumentInput({
    isMyTurn,
    debateId,
    turnCount,
    maxTurns,
    onArgumentSubmitted,
    sessionStatus
}: Props) {
    const [currentArgument, setCurrentArgument] = useState('');
    const [isSubmittingArgument, setIsSubmittingArgument] = useState(false);
    const [argumentSubmitMessage, setArgumentSubmitMessage] = useState('');

    const handleArgumentSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentArgument.trim() || isSubmittingArgument || isNaN(debateId)) return;

        setIsSubmittingArgument(true);
        setArgumentSubmitMessage('Submitting argument...');

        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/debates/${debateId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ argumentText: currentArgument.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit argument');
            }

            setCurrentArgument('');
            setArgumentSubmitMessage('');
            onArgumentSubmitted();
        } catch (err: unknown) {
            console.error("Submit argument error:", err);
            setArgumentSubmitMessage(`Error: ${err instanceof Error ? err.message : 'Could not submit argument.'}`);
        } finally {
            setTimeout(() => setIsSubmittingArgument(false), 300);
        }
    };

    if (sessionStatus === 'unauthenticated') {
        return (
            <p className="text-center text-red-600 mt-4">
                Please <Link href="/login" className="underline">log in</Link> to participate.
            </p>
        );
    }

    return isMyTurn ? (
        <form onSubmit={handleArgumentSubmit} className="mt-4">
            <label htmlFor="argumentInput" className="block text-sm font-medium text-gray-700 mb-1">
                Your Argument (Turn {turnCount + 1} / {maxTurns}):
            </label>
            <textarea
                id="argumentInput"
                value={currentArgument}
                onChange={(e) => setCurrentArgument(e.target.value)}
                rows={4}
                required
                disabled={isSubmittingArgument}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                placeholder="Enter your argument here..."
            />
            <button
                type="submit"
                disabled={isSubmittingArgument || !currentArgument.trim()}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait"
            >
                {isSubmittingArgument ? 'Submitting...' : 'Submit Argument'}
            </button>
            {argumentSubmitMessage && (
                <p className={`text-sm mt-1 ${argumentSubmitMessage.startsWith('Error:') ? 'text-red-600' : 'text-gray-600'}`}>
                    {argumentSubmitMessage}
                </p>
            )}
        </form>
    ) : (
        <p className="text-center text-gray-600 italic mt-4">Waiting for AI response...</p>
    );
}