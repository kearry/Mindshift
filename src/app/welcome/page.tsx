import Link from 'next/link';

// This can be a Server Component
export default function WelcomePage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <div className="text-center max-w-2xl">
                {/* Hero Section */}
                <h1 className="text-4xl font-bold text-indigo-700 mb-4">
                    Welcome to MindShift
                </h1>
                <p className="text-lg text-gray-600 mb-8">
                    The AI-powered debate platform that gamifies critical thinking and persuasive reasoning. Challenge the AI, shift its perspective, earn points, and sharpen your mind.
                    [cite: uploaded:MindShift/project-overview.md]
                </p>

                {/* Call to Action Buttons */}
                <div className="flex justify-center space-x-4 mb-12">
                    <Link
                        href="/register"
                        className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow hover:bg-indigo-700 transition duration-200"
                    >
                        Get Started (Register)
                    </Link>
                    <Link
                        href="/login"
                        className="px-6 py-2 bg-white text-indigo-600 font-semibold rounded-md shadow border border-indigo-200 hover:bg-gray-50 transition duration-200"
                    >
                        Login
                    </Link>
                </div>

                {/* Placeholder for Sample Debate/Topics Link */}
                <div className="text-sm text-gray-500">
                    <Link href="/topics" className="hover:underline">
                        Or explore topics &rarr;
                    </Link>
                </div>
            </div>

            {/* Optional: Add more sections later based on UI Spec [cite: uploaded:MindShift/ui-design-spec.md] */}
            {/* e.g., How it works, Features, Testimonials */}
        </div>
    );
}