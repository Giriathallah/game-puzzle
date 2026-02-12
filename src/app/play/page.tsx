"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePuzzleStore } from "@/stores/puzzleStore";
import { getLevelById } from "@/lib/data";
import { PuzzleContainer } from "@/components/puzzle/puzzleContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

function PlayContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { setLevel, currentLevel, clearLevel } = usePuzzleStore();

    const levelId = searchParams.get("level");

    useEffect(() => {
        if (levelId) {
            const level = getLevelById(levelId);
            if (level) {
                setLevel(level);
            } else {
                // Level tidak ditemukan, redirect ke home
                router.push("/");
            }
        }
    }, [levelId, setLevel, router]);

    if (!currentLevel) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            clearLevel();
                            router.push("/");
                        }}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {currentLevel.name}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {currentLevel.description}
                        </p>
                    </div>
                    <div className="w-24" /> {/* Spacer untuk balance */}
                </div>
            </div>

            {/* Puzzle Container */}
            <PuzzleContainer />
        </div>
    );
}

export default function PlayPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        }>
            <PlayContent />
        </Suspense>
    );
}