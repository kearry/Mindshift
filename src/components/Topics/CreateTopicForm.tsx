'use client'; // Needs state and event handling

import { useState, FormEvent } from 'react';
import { useSession } from 'next-auth/react'; // To check if user is logged in
import { useRouter } from 'next/navigation'; // For potential redirect

export default function CreateTopicForm() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(''); // Optional for now
    const [message, setMessage] = useState('');

    // Redirect if user is not logged in (or show message)
    if (status === 'unauthenticated') {
        // router.push('/login'); // Or show a message
        return <p className="text-center text-red-600">Please log in to create a topic.</p>;
    }

    // Optional: Show loading state
    if (status === 'loading') {
        return <p className="text-center">Loading...</p>;
    }


    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage('');

        try {
            const response = await fetch('/api/topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, description, category }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            setMessage('Topic created successfully!');
            // Optionally clear form or redirect
            setName('');
            setDescription('');
            setCategory('');
            // router.push('/topics'); // Example redirect

        } catch (error: any) {
            console.error('Topic creation failed:', error);
            setMessage(`Topic creation failed: ${error.message}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto p-4 border rounded">
            <h2 className="text-xl font-semibold text-center">Create New Topic</h2>
            <div>
                <label htmlFor="topicName" className="block text-sm font-medium text-gray-700">Topic Name</label>
                <input
                    id="topicName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label htmlFor="topicDescription" className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea
                    id="topicDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            {/* Optional Category Input - can be improved later */}
            <div>
                <label htmlFor="topicCategory" className="block text-sm font-medium text-gray-700">Category (Optional)</label>
                <input
                    id="topicCategory"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <button
                type="submit"
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Create Topic
            </button>
            {message && <p className="text-center text-sm text-red-600 mt-2">{message}</p>}
        </form>
    );
}