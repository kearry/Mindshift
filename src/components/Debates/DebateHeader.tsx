import { FullDebateInfo } from '@/app/debates/[debateId]/page';

interface Props {
    debate: FullDebateInfo;
}

export default function DebateHeader({ debate }: Props) {
    const pointsFormatted = (debate.pointsEarned ?? 0).toFixed(1);
    const pointsClass = (debate.pointsEarned ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';

    return (
        <>
            <h1 className="text-2xl font-bold mb-1">Debate: {debate.topic.name}</h1>
            <p className="text-sm text-gray-600 mb-1">
                Started by: {debate.user.displayName || debate.user.username || 'User'} |
                Goal: Shift Stance {debate.goalDirection} |
                Status: <span className={`font-semibold ${debate.status === 'completed' ? 'text-green-700' : ''}`}>{debate.status}</span>
            </p>
            <p className={`text-sm font-semibold mb-4 ${pointsClass}`}>
                Points Earned: {parseFloat(pointsFormatted) >= 0 ? '+' : ''}{pointsFormatted}
            </p>
        </>
    );
}