"use client";

import { useRouter } from "next/navigation";
import { usePuzzleStore } from "@/stores/puzzleStore";
import { getLevelsByMode } from "@/lib/data";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Home, ArrowRight } from "lucide-react";

export function CompletionDialog() {
    const router = useRouter();
    const { isCompleted, currentLevel, score, attempts, resetLevel, clearLevel } =
        usePuzzleStore();

    if (!currentLevel) return null;

    // Cari level berikutnya
    const levels = getLevelsByMode(currentLevel.mode);
    const currentIndex = levels.findIndex((l) => l.id === currentLevel.id);
    const nextLevel = levels[currentIndex + 1];

    const handleNextLevel = () => {
        if (nextLevel) {
            router.push(`/play?mode=${nextLevel.mode}&level=${nextLevel.id}`);
        }
    };

    const handleHome = () => {
        clearLevel();
        router.push("/");
    };

    return (
        <Dialog open={isCompleted}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                            <Trophy className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-2xl">
                        🎉 Selamat! Puzzle Selesai!
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Kamu berhasil menyelesaikan {currentLevel.name}
                    </DialogDescription>
                </DialogHeader>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Skor</p>
                        <p className="text-3xl font-bold text-blue-600">{score}</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Percobaan</p>
                        <p className="text-3xl font-bold text-purple-600">{attempts}</p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2">
                    {nextLevel && (
                        <Button onClick={handleNextLevel} className="w-full" size="lg">
                            Level Berikutnya
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button variant="outline" onClick={resetLevel}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Main Lagi
                        </Button>
                        <Button variant="ghost" onClick={handleHome}>
                            <Home className="w-4 h-4 mr-2" />
                            Home
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}