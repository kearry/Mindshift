import { ArgumentInfo } from '@/app/debates/[debateId]/page';

interface Props {
    arguments: ArgumentInfo[];
}

export default function ArgumentHistory({ arguments: args }: Props) {
    return (
        <div className="mb-6 border rounded p-4 bg-white h-96 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-2">Arguments</h2>
            {args.length === 0 ? (
                <p className="text-gray-500 italic">No arguments yet.</p>
            ) : (
                <ul className="space-y-4">
                    {args.map(arg => (
                        <li key={arg.argumentId} className="p-2 border-b">
                            <p className="font-semibold text-sm">Turn {arg.turnNumber} ({arg.user?.displayName || 'User'}):</p>
                            <p className="whitespace-pre-wrap">{arg.argumentText}</p>
                            {arg.aiResponse && (
                                <div className="mt-2 p-2 bg-blue-50 rounded">
                                    <p className="font-semibold text-sm text-blue-800">AI Response:</p>
                                    <p className="whitespace-pre-wrap text-sm">{arg.aiResponse}</p>
                                    {arg.stanceAfter != null && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Stance changed from {arg.stanceBefore.toFixed(1)} to {arg.stanceAfter.toFixed(1)}. {arg.shiftReasoning}
                                        </p>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(arg.createdAt).toLocaleString()}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}