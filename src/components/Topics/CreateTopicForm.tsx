// src/components/Topics/CreateTopicForm.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
// Auth check is done on the API side

export default function CreateTopicForm() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [message, setMessage] = useState('');
    const router = useRouter();

    // No need for client-side session check if API requires auth
    // const { status } = useSession();
    // if (status === 'loading') return <p>Loading...</p>;
    // if (status === 'unauthenticated') return <p>Please log in.</p>;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage('');

        try {
            const response = await fetch('/api/topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, category }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            setMessage('Topic created successfully! Redirecting...');
            router.push(`/topics/${data.topicId}`);
        } catch (error: unknown) { // Use unknown
            console.error('Topic creation failed:', error);
            setMessage(`Topic creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto p-4 border rounded">
            <h2 className="text-xl font-semibold text-center">Create New Topic</h2>
            <div>
                <label htmlFor="topicName" className="block text-sm font-medium text-gray-700">Topic Name</label>
                <input id="topicName" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label htmlFor="topicDescription" className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea id="topicDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label htmlFor="topicCategory" className="block text-sm font-medium text-gray-700">Category (Optional)</label>
                <input id="topicCategory" type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <button type="submit" className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Create Topic
            </button>
            {message && <p className="text-center text-sm text-red-600 mt-2">{message}</p>}
        </form>
    );
}