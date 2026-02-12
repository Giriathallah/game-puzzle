"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { usePuzzleStore } from "@/stores/puzzleStore";
import { PuzzleGrid } from "./PuzzleGrid";
import { PuzzlePiece } from "./PuzzlePiece";
import { toast } from "sonner";
import { CompletionDialog } from "./CompletionDialog";
import { Piece } from "@/types/puzzle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy } from "lucide-react";

export function PuzzleContainer() {
    const {
        currentLevel,
        pieces,
        movePiece,
        checkCompletion,
        incrementAttempts,
        resetLevel,
        score,
        attempts,
    } = usePuzzleStore();

    const [activePiece, setActivePiece] = useState<Piece | null>(null);

    if (!currentLevel) return null;

    const placedPieces = pieces.filter((p) => p.currentPosition !== null);
    const unplacedPieces = pieces.filter((p) => p.currentPosition === null);

    const handleDragStart = (event: DragStartEvent) => {
        const piece = pieces.find((p) => p.id === event.active.id);
        if (piece) {
            setActivePiece(piece);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActivePiece(null);
        const { active, over } = event;

        if (!over) return;

        const dropzoneId = over.id as string;
        const [, x, y] = dropzoneId.split("-");
        const targetPosition = { x: parseInt(x), y: parseInt(y) };

        const occupiedPiece = pieces.find(
            (p) =>
                p.currentPosition?.x === targetPosition.x &&
                p.currentPosition?.y === targetPosition.y
        );

        if (occupiedPiece && occupiedPiece.id !== active.id) {
            toast.error("Posisi sudah terisi!", {
                description: "Pilih posisi lain.",
            });
            return;
        }

        const piece = pieces.find((p) => p.id === active.id);
        if (!piece) return;

        const isCorrect =
            targetPosition.x === piece.correctPosition.x &&
            targetPosition.y === piece.correctPosition.y;

        incrementAttempts();

        if (isCorrect) {
            movePiece(piece.id, targetPosition);

            toast.success("✓ Benar!", {
                description: "Potongan ditempatkan dengan tepat.",
            });

            setTimeout(() => {
                const completed = checkCompletion();
                if (completed) {
                    import("canvas-confetti").then((confetti) => {
                        confetti.default({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 },
                        });
                    });
                }
            }, 100);
        } else {
            toast.error("✗ Salah", {
                description: "Coba lagi! Perhatikan gambarnya.",
            });
        }
    };

    return (
        <>
            <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="max-w-6xl mx-auto">
                    {/* Stats Bar */}
                    <div className="flex justify-between items-center mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                        <div className="flex gap-6">
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Skor</p>
                                <p className="text-2xl font-bold text-blue-600 flex items-center gap-1">
                                    <Trophy className="w-5 h-5" />
                                    {score}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Percobaan</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {attempts}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Tersisa</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {unplacedPieces.length}
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={resetLevel}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restart
                        </Button>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_300px] gap-8">
                        {/* Grid Area */}
                        <div className="flex justify-center order-2 lg:order-1">
                            <PuzzleGrid
                                mode={currentLevel.mode}
                                imageUrl={currentLevel.mode === "fill" ? (currentLevel.backgroundUrl || "") : ""}
                                rows={currentLevel.gridSize}
                                cols={currentLevel.gridSize}
                            />
                        </div>

                        {/* Pieces Sidebar */}
                        <Card className="p-4 h-fit order-1 lg:order-2">
                            <h3 className="font-semibold text-lg mb-4">
                                Potongan Tersedia ({unplacedPieces.length})
                            </h3>
                            <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                                {unplacedPieces.map((piece) => (
                                    <PuzzlePiece
                                        key={piece.id}
                                        piece={piece}
                                        imageUrl={currentLevel.mode === "fill" ? (currentLevel.backgroundUrl || "") : ""}
                                        rows={currentLevel.gridSize}
                                        cols={currentLevel.gridSize}
                                    />
                                ))}
                                {unplacedPieces.length === 0 && (
                                    <p className="col-span-2 text-center text-gray-500 py-8">
                                        Semua potongan sudah ditempatkan!
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activePiece ? (
                        <div className="opacity-80 rotate-6 scale-110">
                            <PuzzlePiece
                                piece={activePiece}
                                imageUrl={currentLevel.mode === "fill" ? (currentLevel.backgroundUrl || "") : activePiece.url}
                                rows={currentLevel.gridSize}
                                cols={currentLevel.gridSize}
                                className="w-[100px] h-[100px]" // Explicit size for overlay
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <CompletionDialog />
        </>
    );
}