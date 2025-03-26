'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react'; // Import signIn
import { useRouter } from 'next/navigation'; // Import for redirection

export default function LoginForm() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const router = useRouter(); // Hook for redirection

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage('');

        try {
            // Use signIn from next-auth
            const result = await signIn('credentials', {
                // Redirect false means we handle errors/success here, not auto-redirect
                redirect: false,
                identifier: identifier,
                password: password,
            });

            if (result?.error) {
                // Handle sign-in errors (e.g., invalid credentials)
                setMessage(result.error === 'CredentialsSignin' ? 'Invalid credentials' : result.error);
            } else if (result?.ok) {
                // Handle successful sign-in
                setMessage('Login successful! Redirecting...');
                // Redirect to a dashboard or home page after successful login
                router.push('/'); // Redirect to home page for example
                // You might want router.refresh() as well depending on your setup
            } else {
                // Handle other unexpected cases
                setMessage('An unexpected error occurred during login.');
            }

        } catch (error) {
            // Catch unexpected errors during the signIn process itself
            console.error('Login submit error:', error);
            setMessage('An error occurred. Please try again.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto p-4 border rounded">
            <h2 className="text-xl font-semibold text-center">Login</h2>
            <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">Username or Email</label>
                <input
                    id="identifier"
                    type="text"
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