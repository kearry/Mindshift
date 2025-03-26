'use client'; // Mark this as a Client Component

import { useState, FormEvent } from 'react';

export default function LoginForm() {
    const [identifier, setIdentifier] = useState(''); // Can be username or email
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState(''); // To display success/error messages

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(''); // Clear previous messages

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifier, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Use error message from API response if available
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            // TODO: Handle successful login (e.g., store token/session, redirect)
            // For now, just display the success message from the API
            setMessage(data.message || 'Login successful!');
            // Optionally clear form or redirect user
            setIdentifier('');
            setPassword('');


        } catch (error: any) {
            console.error('Login failed:', error);
            setMessage(`Login failed: ${error.message}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto p-4 border rounded">
            <h2 className="text-xl font-semibold text-center">Login</h2>
            <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">Username or Email</label>
                <input
                    id="identifier"
                    type="text" // Use text to allow either username or email
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <button
                type="submit"
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Login
            </button>
            {message && <p className="text-center text-sm text-red-600 mt-2">{message}</p>}
        </form>
    );
}