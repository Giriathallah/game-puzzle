import { Loader2 } from "lucide-react";

export function LoadingPuzzle() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Memuat puzzle...</p>
        </div>
    );
}