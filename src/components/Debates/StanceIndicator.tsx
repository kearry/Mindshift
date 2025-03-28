interface Props {
    currentStance: number;
    initialStance: number;
    status: string;
}

export default function StanceIndicator({ currentStance, initialStance, status }: Props) {
    const stancePercentage = currentStance * 10;

    return (
        <div className="mb-4 p-3 bg-gray-100 rounded">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Supportive (0)</span>
                <span>Neutral (5)</span>
                <span>Opposed (10)</span>
            </div>
            <div className="w-full bg-gradient-to-r from-green-300 via-yellow-300 to-red-300 h-4 rounded relative overflow-hidden border border-gray-300">
                <div
                    className="absolute top-0 bottom-0 w-1 bg-black rounded shadow"
                    style={{ left: `calc(${stancePercentage}% - 2px)` }}
                    title={`Current Stance: ${currentStance.toFixed(1)}`}
                ></div>
                <div
                    className="absolute top-0 bottom-0 w-px bg-gray-500 opacity-50"
                    style={{ left: `${initialStance * 10}%` }}
                    title={`Initial Stance: ${initialStance.toFixed(1)}`}
                ></div>
            </div>
            <p className="text-center text-sm font-semibold mt-1">
                {(status === 'completed' ? 'Final' : 'Current')} AI Stance: {currentStance.toFixed(1)} / 10
            </p>
        </div>
    );
}