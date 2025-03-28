interface Props {
    summaryArticle: string | null;
    status: string;
}

export default function DebateSummary({ summaryArticle, status }: Props) {
    if (!summaryArticle) {
        return <p className="text-center italic text-gray-500 mt-4">Summary is being generated or failed...</p>;
    }

    return (
        <div className="mt-6 p-4 border rounded bg-yellow-50">
            <h2 className="text-xl font-semibold mb-3 text-center">Debate Summary</h2>
            <p className="text-sm whitespace-pre-wrap">{summaryArticle}</p>
        </div>
    );
}