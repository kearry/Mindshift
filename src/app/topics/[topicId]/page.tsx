// src/app/topics/[topicId]/page.tsx

// ****** THIS MUST BE THE VERY FIRST LINE ******
'use client';
// ****** NO COMMENTS OR EMPTY LINES ABOVE ******

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import type { Prisma } from '@prisma/client';

// --- Define expected data structure (Helper Types) ---
type UserSnippet = { userId: number; username?: string | null; displayName?: string | null; };
type DebateSnippet = { debateId: number; status: string; createdAt: string; pointsEarned: number | null; user: UserSnippet | null; };
type NewDebateResponse = { debateId: number; };
type ScaleDefinitionMap = { [key: string]: string };
type TopicWithDebates = { topicId: number; name: string; description: string | null; category: string | null; currentStance: number; stanceReasoning: string | null; isActive: boolean; createdAt: string; updatedAt: string; debates: DebateSnippet[]; scaleDefinitions: Prisma.JsonValue | null; };
// --- End of Helper Types ---


// --- Main Page Component ---
export default function TopicDetailPage() {
    // --- State Variables ---
    const [topic, setTopic] = useState<TopicWithDebates | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeletingTopic, setIsDeletingTopic] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<'left' | 'right' | null>(null);
    const [isStartingDebate, setIsStartingDebate] = useState(false);
    const [startDebateError, setStartDebateError] = useState<string | null>(null);

    // --- Hooks ---
    const params = useParams();
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const topicId = params?.topicId as string;

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (topicId) {
            const fetchTopic = async () => {
                setLoading(true); setError(null); setStartDebateError(null);
                try {
                    const response = await fetch(`/api/topics/${topicId}`);
                    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Failed to fetch topic (Status: ${response.status})`); }
                    const data: TopicWithDebates = await response.json();
                    console.log("Raw data fetched from API:", JSON.stringify(data, null, 2)); // Keep log for debugging
                    setTopic(data);
                } catch (err: unknown) { const message = err instanceof Error ? err.message : 'An unknown error occurred'; setError(message); console.error("Error fetching topic data:", err); setTopic(null); }
                finally { setLoading(false); }
            };
            fetchTopic();
        } else { setError("Topic ID is missing in the URL."); setLoading(false); }
    }, [topicId]);

    // --- Delete Topic Function ---
    const handleDeleteTopic = async () => {
        if (!topic || !session?.user) { setError("Cannot delete: Topic data missing or not logged in."); return; }
        const canAttemptDeleteCheck = topic.debates.length === 0;
        if (!canAttemptDeleteCheck) { alert("Cannot delete topic: It has associated debates."); return; }
        const confirmation = window.confirm(`Are you sure you want to delete the topic "${topic.name}"? This action cannot be undone as it has no debates.`);
        if (!confirmation) return;
        setIsDeletingTopic(true); setError(null);
        try {
            const response = await fetch(`/api/topics/${topic.topicId}`, { method: 'DELETE' });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Failed to delete topic (Status: ${response.status})`); }
            alert(`Topic "${topic.name}" deleted successfully.`); router.push('/topics');
        } catch (err: unknown) { const message = err instanceof Error ? err.message : 'An unknown error occurred'; setError(`Deletion failed: ${message}`); console.error("Error deleting topic:", err); }
        finally { setIsDeletingTopic(false); }
    };

    // --- Start New Debate Function ---
    const handleStartDebate = async (goal: 'left' | 'right') => {
        if (!topic || !session?.user?.id) { setStartDebateError("Cannot start debate: Topic data missing or not logged in."); return; }
        // Prevent starting multiple debates simultaneously
        if (isStartingDebate) return;

        setIsStartingDebate(true); setStartDebateError(null); setSelectedGoal(goal);
        console.log(`Starting new debate for topic ${topic.topicId} with goal: ${goal}`);
        try {
            const response = await fetch(`/api/debates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId: topic.topicId, goalDirection: goal }), });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Failed to start debate (Status: ${response.status})`); }
            const newDebate: NewDebateResponse = await response.json();
            console.log("Debate started successfully:", newDebate);
            router.push(`/debates/${newDebate.debateId}`);
            // Keep isStartingDebate true until navigation completes
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred';
            setStartDebateError(`Failed to start debate: ${message}`); console.error("Error starting debate:", err);
            setSelectedGoal(null); // Reset goal only on error
            setIsStartingDebate(false); // Reset loading state on error
        }
        // NOTE: finally block removed - we want isStartingDebate to remain true during successful redirect
    };

    // Helper to safely parse and validate scaleDefinitions
    const getValidScaleDefinitions = (defs: Prisma.JsonValue | null): ScaleDefinitionMap | null => {
        console.log("getValidScaleDefinitions input:", defs);
        if (!defs || typeof defs !== 'object' || Array.isArray(defs)) { console.log("Validation failed: Not a non-array object."); return null; }
        const allValuesAreStrings = Object.values(defs).every(v => typeof v === 'string');
        console.log("Are all values strings?", allValuesAreStrings);
        if (allValuesAreStrings) { console.log("Validation passed, returning object."); return defs as ScaleDefinitionMap; }
        console.warn("Validation failed: Scale definitions values are not all strings:", defs); return null;
    };


    // --- Render Logic ---
    if (loading || sessionStatus === 'loading') { return <div className="container mx-auto p-4 text-center">Loading topic details...</div>; }
    if (error || !topic) { return <div className="container mx-auto p-4 text-center text-red-500">Error: {error || 'Topic not found.'}</div>; }

    const canAttemptDelete = topic.debates.length === 0;
    console.log("Processing topic.scaleDefinitions:", topic.scaleDefinitions);
    const validScaleDefinitions = getValidScaleDefinitions(topic.scaleDefinitions);
    console.log("Result of getValidScaleDefinitions (validScaleDefinitions):", validScaleDefinitions);

    // --- Main Page Content ---
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">

            {/* Topic Information Section */}
            <div className="mb-6 border-b pb-4">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{topic.name}</h1>
                {topic.description && (<p className="text-lg text-gray-700 dark:text-gray-300 mb-3">{topic.description}</p>)}
                {topic.category && (<p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Category: {topic.category}</p>)}
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1"> Current AI&apos;s Stance: {topic.currentStance.toFixed(1)}/10 (0=Support, 10=Oppose) </p>
                {topic.stanceReasoning && (<p className="text-xs italic text-gray-600 dark:text-gray-400 mb-3"> AI Reasoning: {topic.stanceReasoning} </p>)}
                <p className="text-xs text-gray-400 dark:text-gray-500"> Topic ID: {topic.topicId} | Created: {new Date(topic.createdAt).toLocaleDateString()} </p>
            </div>

            {/* Admin Actions Section */}
            {session?.user && (
                <div className="my-4 p-3 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <h3 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">Admin Actions</h3>
                    <button onClick={handleDeleteTopic} disabled={!canAttemptDelete || isDeletingTopic}
                        className={`px-3 py-1 rounded text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${!canAttemptDelete || isDeletingTopic ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800'}`}
                        title={!canAttemptDelete ? "Cannot delete: Topic has associated debates." : "Delete this topic"} >
                        {isDeletingTopic ? 'Deleting...' : 'Delete Topic'}
                    </button>
                    {!canAttemptDelete && (<p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1"> This topic cannot be deleted because it has associated debates. </p>)}
                    {error && error.startsWith('Deletion failed:') && (<p className="text-red-600 mt-2 text-sm">{error}</p>)}
                </div>
            )}

            {/* Start New Debate Section - Simplified and Checked */}
            <div className="my-8 p-6 border rounded-lg shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 dark:border-gray-700">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Start a New Debate</h2>
                {/* Only show buttons if logged in */}
                {sessionStatus === 'authenticated' && topic ? (
                    <div>
                        <p className="mb-4 text-gray-700 dark:text-gray-300"> Challenge the AI&apos;s current stance of <strong className="font-bold">{topic.currentStance.toFixed(1)}/10</strong>. Choose your goal: </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* --- Button 1: Persuade Left --- */}
                            <button
                                onClick={() => handleStartDebate('left')}
                                disabled={isStartingDebate} // Disable button if *any* start process is active
                                // Combine base styles with conditional styles
                                className={`flex-1 px-5 py-3 rounded-md font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 dark:focus:ring-offset-gray-900 ${isStartingDebate
                                        ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' // Disabled style
                                        : 'bg-green-600 hover:bg-green-700 focus:ring-green-500' // Enabled style
                                    }`}
                            >
                                {/* Conditional Text */}
                                {isStartingDebate && selectedGoal === 'left' ? 'Starting...' : 'Persuade towards Support (0)'}
                            </button>

                            {/* --- Button 2: Persuade Right --- */}
                            <button
                                onClick={() => handleStartDebate('right')}
                                disabled={isStartingDebate} // Disable button if *any* start process is active
                                // Combine base styles with conditional styles
                                className={`flex-1 px-5 py-3 rounded-md font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 dark:focus:ring-offset-gray-900 ${isStartingDebate
                                        ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' // Disabled style
                                        : 'bg-red-600 hover:bg-red-700 focus:ring-red-500' // Enabled style
                                    }`}
                            >
                                {/* Conditional Text */}
                                {isStartingDebate && selectedGoal === 'right' ? 'Starting...' : 'Persuade towards Opposition (10)'}
                            </button>
                        </div>
                        {/* Display start debate errors */}
                        {startDebateError && (<p className="text-red-600 mt-3 text-sm">{startDebateError}</p>)}
                    </div>
                ) : (
                    // Login prompt if not authenticated
                    <p className="text-center text-gray-600 dark:text-gray-400">
                        Please{' '}
                        <Link href="/api/auth/signin" className="text-indigo-600 hover:underline dark:text-indigo-400">
                            sign in
                        </Link>
                        {' '}to start a new debate.
                    </p>
                )}
            </div>

            {/* Scale Definitions Display Section */}
            {console.log("Checking render condition. validScaleDefinitions is:", validScaleDefinitions ? "truthy (object)" : "falsy (null)")}
            {validScaleDefinitions && (
                <div className="my-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">AI Stance Scale Definition for this Topic</h3>
                    <ul className="space-y-1 text-sm">
                        {Array.from({ length: 11 }, (_, i) => i.toString()).map((scaleKey) => (
                            <li key={scaleKey} className="flex">
                                <strong className="w-8 text-right mr-2 flex-shrink-0">{scaleKey}:</strong>
                                <span className="text-gray-700 dark:text-gray-300"> {validScaleDefinitions[scaleKey] ?? <em className="text-gray-400">(Not defined)</em>} </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {!loading && !validScaleDefinitions && topic.scaleDefinitions !== null && (<p className="text-sm text-yellow-600 dark:text-yellow-400 my-8">Note: AI scale definitions were found but could not be displayed due to unexpected format.</p>)}
            {!loading && topic.scaleDefinitions === null && (<p className="text-sm text-gray-500 dark:text-gray-400 my-8">Note: AI did not provide specific scale definitions for this topic.</p>)}

            {/* Associated Debates Section */}
            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Associated Debates ({topic.debates.length})</h2>
                {topic.debates.length > 0 ? (
                    <ul className="space-y-4">
                        {topic.debates.map((debate) => (
                            <li key={debate.debateId} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                    <div className="flex-grow min-w-[200px]">
                                        <Link href={`/debates/${debate.debateId}`} className="text-lg font-semibold text-blue-600 hover:underline dark:text-blue-400"> Debate #{debate.debateId} </Link>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1"> Started by: {debate.user?.displayName || debate.user?.username || 'Unknown User'} {' '}on {new Date(debate.createdAt).toLocaleDateString()} </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${debate.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : debate.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}> {debate.status.replace('_', ' ')} </span>
                                        {debate.status === 'completed' && debate.pointsEarned !== null && (<p className="text-xs mt-1 text-gray-500 dark:text-gray-400">Points: {debate.pointsEarned.toFixed(1)}</p>)}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (<p className="text-gray-500 dark:text-gray-400">No debates have been started for this topic yet.</p>)}
            </div>

        </div> // End main container div
    ); // End return
} // End component