'use client';

import { useDroppable } from '@dnd-kit/core';
import { usePuzzleStore } from '@/stores/puzzleStore';
import { PuzzlePiece } from './PuzzlePiece';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import React from 'react';

interface Props {
    mode: "fill" | "full";
    imageUrl: string;
    rows: number;
    cols: number;
}

export function PuzzleGrid({ mode, imageUrl, rows, cols }: Props) {
    const { pieces } = usePuzzleStore();

    return (
        <div className="relative w-full max-w-[600px] aspect-square mx-auto bg-gray-200 dark:bg-slate-800 rounded-lg overflow-hidden shadow-xl border-4 border-slate-300 dark:border-slate-700">
            {/* Background untuk fitur 1 */}
            {mode === "fill" && (
                <div className="absolute inset-0 w-full h-full">
                    <Image
                        src={imageUrl}
                        fill
                        alt="background"
                        className="object-cover opacity-30 blur-[2px]" // low opacity + blur untuk efek "hilang"
                    />
                </div>
            )}

            <div
                className="grid h-full relative z-10"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
            >
                {Array.from({ length: rows * cols }).map((_, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    // Check if a piece occupies this slot
                    const piece = pieces.find(
                        p => p.currentPosition?.y === row && p.currentPosition?.x === col
                    );

                    return (
                        <DroppableSlot key={`${row}-${col}`} id={`${row}-${col}`} row={row} col={col}>
                            {piece ? (
                                <div className="w-full h-full p-0.5">
                                    {/* 
                      When rendering in grid, we want it to fill the slot.
                      PuzzlePiece has default w-20 w-24 etc. We need to override to w-full h-full.
                   */}
                                    <PuzzlePiece
                                        piece={piece}
                                        imageUrl={imageUrl}
                                        rows={rows}
                                        cols={cols}
                                        className="w-full h-full !cursor-default" // Disable visual grab if locked? DndKit still handles drag unless we disable it. 
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full border border-dashed border-gray-400/50 bg-white/10 flex items-center justify-center">
                                    {/* visual hole */}
                                    {/* <span className="text-gray-500 text-xs">Drop</span> */}
                                </div>
                            )}
                        </DroppableSlot>
                    );
                })}
            </div>
        </div>
    );
}

function DroppableSlot({ id, children, row, col }: { id: string; children: React.ReactNode; row: number; col: number }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "relative w-full h-full transition-colors",
                isOver ? "bg-blue-500/20" : ""
            )}
        >
            {children}
        </div>
    );
}
