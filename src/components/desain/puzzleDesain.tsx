// components/WoodPuzzleGame.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    useDroppable,
    useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Types
type Piece = {
    id: string;
    src: string;
    correctIndex: number;
    row: number;
    col: number;
    padding: number;
    baseWidth: number;
    baseHeight: number;
};

type PuzzleMode = 'partial' | 'empty';

// Pre-generate tab pattern for interlocking pieces
function generateTabPattern(rows: number, cols: number): {
    horizontal: boolean[][];
    vertical: boolean[][];
} {
    const horizontal: boolean[][] = [];
    const vertical: boolean[][] = [];

    for (let row = 0; row <= rows; row++) {
        horizontal[row] = [];
        for (let col = 0; col < cols; col++) {
            if (row === 0 || row === rows) {
                horizontal[row][col] = false;
            } else {
                horizontal[row][col] = (row + col) % 2 === 0;
            }
        }
    }

    for (let row = 0; row < rows; row++) {
        vertical[row] = [];
        for (let col = 0; col <= cols; col++) {
            if (col === 0 || col === cols) {
                vertical[row][col] = false;
            } else {
                vertical[row][col] = (row + col + 1) % 2 === 0;
            }
        }
    }

    return { horizontal, vertical };
}

// Generate puzzle piece path with proper interlocking shapes
function generatePuzzlePath(
    width: number,
    height: number,
    row: number,
    col: number,
    rows: number,
    cols: number,
    tabPattern: { horizontal: boolean[][]; vertical: boolean[][] }
): string {
    const minDimension = Math.min(width, height);
    const tabSize = minDimension * 0.15;
    const tabDepth = tabSize * 0.85;

    const hasTopSlot = row > 0 && tabPattern.horizontal[row][col];
    const hasTopTab = row > 0 && !tabPattern.horizontal[row][col];
    const hasBottomTab = row < rows - 1 && tabPattern.horizontal[row + 1][col];
    const hasBottomSlot = row < rows - 1 && !tabPattern.horizontal[row + 1][col];
    const hasLeftSlot = col > 0 && tabPattern.vertical[row][col];
    const hasLeftTab = col > 0 && !tabPattern.vertical[row][col];
    const hasRightTab = col < cols - 1 && tabPattern.vertical[row][col + 1];
    const hasRightSlot = col < cols - 1 && !tabPattern.vertical[row][col + 1];

    let path = `M 0,0`;

    // Top edge
    if (hasTopTab) {
        path += ` L ${width * 0.35},0`;
        path += ` C ${width * 0.35},${-tabDepth * 0.4} ${width * 0.4},${-tabDepth} ${width * 0.5},${-tabDepth}`;
        path += ` C ${width * 0.6},${-tabDepth} ${width * 0.65},${-tabDepth * 0.4} ${width * 0.65},0`;
        path += ` L ${width},0`;
    } else if (hasTopSlot) {
        path += ` L ${width * 0.35},0`;
        path += ` C ${width * 0.35},${tabDepth * 0.4} ${width * 0.4},${tabDepth} ${width * 0.5},${tabDepth}`;
        path += ` C ${width * 0.6},${tabDepth} ${width * 0.65},${tabDepth * 0.4} ${width * 0.65},0`;
        path += ` L ${width},0`;
    } else {
        path += ` L ${width},0`;
    }

    // Right edge
    if (hasRightTab) {
        path += ` L ${width},${height * 0.35}`;
        path += ` C ${width + tabDepth * 0.4},${height * 0.35} ${width + tabDepth},${height * 0.4} ${width + tabDepth},${height * 0.5}`;
        path += ` C ${width + tabDepth},${height * 0.6} ${width + tabDepth * 0.4},${height * 0.65} ${width},${height * 0.65}`;
        path += ` L ${width},${height}`;
    } else if (hasRightSlot) {
        path += ` L ${width},${height * 0.35}`;
        path += ` C ${width - tabDepth * 0.4},${height * 0.35} ${width - tabDepth},${height * 0.4} ${width - tabDepth},${height * 0.5}`;
        path += ` C ${width - tabDepth},${height * 0.6} ${width - tabDepth * 0.4},${height * 0.65} ${width},${height * 0.65}`;
        path += ` L ${width},${height}`;
    } else {
        path += ` L ${width},${height}`;
    }

    // Bottom edge
    if (hasBottomTab) {
        path += ` L ${width * 0.65},${height}`;
        path += ` C ${width * 0.65},${height + tabDepth * 0.4} ${width * 0.6},${height + tabDepth} ${width * 0.5},${height + tabDepth}`;
        path += ` C ${width * 0.4},${height + tabDepth} ${width * 0.35},${height + tabDepth * 0.4} ${width * 0.35},${height}`;
        path += ` L 0,${height}`;
    } else if (hasBottomSlot) {
        path += ` L ${width * 0.65},${height}`;
        path += ` C ${width * 0.65},${height - tabDepth * 0.4} ${width * 0.6},${height - tabDepth} ${width * 0.5},${height - tabDepth}`;
        path += ` C ${width * 0.4},${height - tabDepth} ${width * 0.35},${height - tabDepth * 0.4} ${width * 0.35},${height}`;
        path += ` L 0,${height}`;
    } else {
        path += ` L 0,${height}`;
    }

    // Left edge
    if (hasLeftTab) {
        path += ` L 0,${height * 0.65}`;
        path += ` C ${-tabDepth * 0.4},${height * 0.65} ${-tabDepth},${height * 0.6} ${-tabDepth},${height * 0.5}`;
        path += ` C ${-tabDepth},${height * 0.4} ${-tabDepth * 0.4},${height * 0.35} 0,${height * 0.35}`;
        path += ` L 0,0`;
    } else if (hasLeftSlot) {
        path += ` L 0,${height * 0.65}`;
        path += ` C ${tabDepth * 0.4},${height * 0.65} ${tabDepth},${height * 0.6} ${tabDepth},${height * 0.5}`;
        path += ` C ${tabDepth},${height * 0.4} ${tabDepth * 0.4},${height * 0.35} 0,${height * 0.35}`;
        path += ` L 0,0`;
    } else {
        path += ` L 0,0`;
    }

    path += ` Z`;
    return path;
}

// Split image with padding
async function splitImage(
    imageSrc: string,
    rows: number,
    cols: number,
    usePuzzleShapes: boolean = true
): Promise<{ pieces: Piece[]; imageWidth: number; imageHeight: number; tabPadding: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageSrc;

        img.onload = () => {
            const pieceWidth = img.width / cols;
            const pieceHeight = img.height / rows;
            const pieces: Piece[] = [];

            const tabPattern = generateTabPattern(rows, cols);

            const minDimension = Math.min(pieceWidth, pieceHeight);
            const tabSize = minDimension * 0.15;
            const padding = usePuzzleShapes ? tabSize * 1.0 : 0;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const canvas = document.createElement('canvas');
                    canvas.width = pieceWidth + padding * 2;
                    canvas.height = pieceHeight + padding * 2;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Canvas context error'));

                    if (usePuzzleShapes) {
                        const pathStr = generatePuzzlePath(
                            pieceWidth,
                            pieceHeight,
                            row,
                            col,
                            rows,
                            cols,
                            tabPattern
                        );
                        const path = new Path2D(pathStr);

                        ctx.save();
                        ctx.translate(padding, padding);
                        ctx.clip(path);

                        ctx.drawImage(
                            img,
                            col * pieceWidth - padding,
                            row * pieceHeight - padding,
                            pieceWidth + padding * 2,
                            pieceHeight + padding * 2,
                            -padding,
                            -padding,
                            pieceWidth + padding * 2,
                            pieceHeight + padding * 2
                        );

                        ctx.restore();

                        ctx.save();
                        ctx.translate(padding, padding);
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke(path);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                        ctx.lineWidth = 0.8;
                        ctx.stroke(path);
                        ctx.restore();
                    } else {
                        canvas.width = pieceWidth;
                        canvas.height = pieceHeight;
                        ctx.drawImage(
                            img,
                            col * pieceWidth,
                            row * pieceHeight,
                            pieceWidth,
                            pieceHeight,
                            0,
                            0,
                            pieceWidth,
                            pieceHeight
                        );
                    }

                    const index = row * cols + col;
                    pieces.push({
                        id: `piece-${index}`,
                        src: canvas.toDataURL('image/png'),
                        correctIndex: index,
                        row,
                        col,
                        padding,
                        baseWidth: pieceWidth,
                        baseHeight: pieceHeight,
                    });
                }
            }
            resolve({ pieces, imageWidth: img.width, imageHeight: img.height, tabPadding: padding });
        };

        img.onerror = () => reject(new Error('Gagal load gambar'));
    });
}

// Draggable Piece Component
function DraggablePiece({
    id,
    src,
    isInGrid = false,
    padding = 0,
    baseWidth = 100,
    baseHeight = 100,
}: {
    id: string;
    src: string;
    isInGrid?: boolean;
    padding?: number;
    baseWidth?: number;
    baseHeight?: number;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const totalWidth = baseWidth + padding * 2;
    const totalHeight = baseHeight + padding * 2;

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        ...(isInGrid ? {
            position: 'absolute' as const,
            width: `${totalWidth}px`,
            height: `${totalHeight}px`,
            left: `${-padding}px`,
            top: `${-padding}px`,
            pointerEvents: 'auto' as const,
        } : {
            width: '100%',
            height: '100%',
        }),
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="flex items-center justify-center transition-transform hover:scale-105"
        >
            <img
                src={src}
                alt=""
                className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
                draggable={false}
            />
        </div>
    );
}

// Droppable Slot Component
function DroppableSlot({
    index,
    piece,
    totalCols,
    totalRows,
    baseWidth,
    baseHeight,
    showOutline = true,
    tabPattern,
}: {
    index: number;
    piece: Piece | null;
    totalCols: number;
    totalRows: number;
    baseWidth: number;
    baseHeight: number;
    showOutline?: boolean;
    tabPattern?: { horizontal: boolean[][]; vertical: boolean[][] };
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
    const isEmpty = !piece;

    const row = Math.floor(index / totalCols);
    const col = index % totalCols;

    let outlinePath = '';
    if (isEmpty && showOutline && tabPattern) {
        outlinePath = generatePuzzlePath(
            baseWidth,
            baseHeight,
            row,
            col,
            totalRows,
            totalCols,
            tabPattern
        );
    }

    return (
        <div
            ref={setNodeRef}
            id={`slot-${index}`}
            className={`relative transition-all ${isEmpty
                ? isOver
                    ? 'bg-green-300/30 scale-105'
                    : ''
                : ''
                }`}
            style={{
                width: `${baseWidth}px`,
                height: `${baseHeight}px`,
                margin: 0,
                padding: 0,
                overflow: 'visible',
                zIndex: isEmpty ? 1 : (row * 10 + col + 10),
            }}
        >
            {isEmpty && showOutline && outlinePath && (
                <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: baseWidth, height: baseHeight, zIndex: 2 }}
                    viewBox={`0 0 ${baseWidth} ${baseHeight}`}
                >
                    <path
                        d={outlinePath}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.6)"
                        strokeWidth="3"
                        strokeDasharray="8,4"
                    />
                </svg>
            )}

            {isEmpty && !showOutline && !isOver && (
                <div className="absolute inset-[2px] border-2 border-dashed border-white/50 rounded-sm pointer-events-none" />
            )}

            {piece && (
                <DraggablePiece
                    id={piece.id}
                    src={piece.src}
                    isInGrid
                    padding={piece.padding * (baseWidth / piece.baseWidth)}
                    baseWidth={baseWidth}
                    baseHeight={baseHeight}
                />
            )}
        </div>
    );
}

// Timer Hook
function useTimer(initialTime: number, onTimeUp?: () => void) {
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (!isRunning || timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setIsRunning(false);
                    onTimeUp?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isRunning, timeLeft, onTimeUp]);

    const start = () => setIsRunning(true);
    const pause = () => setIsRunning(false);
    const reset = (newTime?: number) => {
        setTimeLeft(newTime ?? initialTime);
        setIsRunning(false);
    };

    const formatTime = () => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return { timeLeft, isRunning, start, pause, reset, formatTime };
}

// Main Component
export default function WoodPuzzleGame({
    imageSrc = '/assets2600.jpg',
    rows = 4,
    cols = 4,
    mode = 'partial' as PuzzleMode,
    usePuzzleShapes = true,
    showGuideImage = true,
    guideOpacity = 0.3,
    timeLimit = 300, // 5 minutes default
}) {
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [gridItems, setGridItems] = useState<string[]>(Array(rows * cols).fill(''));
    const [poolItems, setPoolItems] = useState<string[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSolved, setIsSolved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [tabPadding, setTabPadding] = useState(0);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
    const [showPauseMenu, setShowPauseMenu] = useState(false);
    const [showPiecesDrawer, setShowPiecesDrawer] = useState(false);

    const timer = useTimer(timeLimit, () => {
        alert('Waktu habis! Puzzle belum selesai 😔');
    });

    const totalSlots = rows * cols;
    const completedPieces = gridItems.filter(id => id !== '').length;
    const progress = (completedPieces / totalSlots) * 100;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const { pieces: splitPieces, imageWidth, imageHeight, tabPadding: padding } = await splitImage(
                    imageSrc,
                    rows,
                    cols,
                    usePuzzleShapes
                );
                setPieces(splitPieces);
                setImageDimensions({ width: imageWidth, height: imageHeight });
                setTabPadding(padding);
                setBackgroundImageUrl(imageSrc);

                const shuffledPieces = [...splitPieces].sort(() => Math.random() - 0.5);
                const shuffledIds = shuffledPieces.map(p => p.id);

                if (mode === 'partial') {
                    const placedCount = Math.floor(totalSlots * 0.4) + 2;
                    const placedPieces = shuffledPieces.slice(0, placedCount);

                    const newGrid = Array(totalSlots).fill('');
                    placedPieces.forEach(piece => {
                        newGrid[piece.correctIndex] = piece.id;
                    });

                    const remainingIds = shuffledIds.filter(id => !placedPieces.some(p => p.id === id));

                    setGridItems(newGrid);
                    setPoolItems(remainingIds);
                } else {
                    setGridItems(Array(totalSlots).fill(''));
                    setPoolItems(shuffledIds);
                }

                // Start timer after puzzle is loaded
                setTimeout(() => timer.start(), 500);
            } catch (err) {
                console.error(err);
                alert('Gagal memuat gambar. Cek path gambar dan console.');
            } finally {
                setLoading(false);
            }
        })();
    }, [imageSrc, rows, cols, mode, usePuzzleShapes]);

    useEffect(() => {
        if (poolItems.length === 0 && !gridItems.includes('')) {
            const correct = gridItems.every((id, idx) => pieces.find(p => p.id === id)?.correctIndex === idx);
            if (correct && !isSolved) {
                setIsSolved(true);
                timer.pause();
                setTimeout(() => {
                    alert(`🎉 Puzzle selesai dalam ${timer.formatTime()}! Hebat!`);
                }, 300);
            }
        }
    }, [gridItems, poolItems, pieces]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activePieceId = active.id as string;
        const piece = pieces.find(p => p.id === activePieceId);
        if (!piece) return;

        if (over.id.toString().startsWith('slot-')) {
            const targetIndex = parseInt(over.id.toString().replace('slot-', ''), 10);

            if (gridItems[targetIndex] !== '') {
                return;
            }
            if (piece.correctIndex !== targetIndex) {
                return;
            }

            setGridItems(prev => {
                const newGrid = [...prev];
                newGrid[targetIndex] = activePieceId;
                return newGrid;
            });
            setPoolItems(prev => prev.filter(id => id !== activePieceId));
        } else if (over.id === 'pool') {
            const fromGridIndex = gridItems.indexOf(activePieceId);
            if (fromGridIndex !== -1) {
                setGridItems(prev => {
                    const newGrid = [...prev];
                    newGrid[fromGridIndex] = '';
                    return newGrid;
                });
                setPoolItems(prev => [...prev, activePieceId]);
            }
        }
    };

    const activePiece = activeId ? pieces.find(p => p.id === activeId) : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">🧩</div>
                    <div className="text-2xl font-bold text-[#5d4037]">Memuat Puzzle...</div>
                </div>
            </div>
        );
    }

    const pieceWidth = pieces.length > 0 ? pieces[0].baseWidth : 100;
    const pieceHeight = pieces.length > 0 ? pieces[0].baseHeight : 100;
    const gridWidth = pieceWidth * cols;
    const gridHeight = pieceHeight * rows;

    const maxDisplayWidth = 600;
    const maxDisplayHeight = 600;
    const scale = Math.min(1, maxDisplayWidth / gridWidth, maxDisplayHeight / gridHeight);
    const displayWidth = gridWidth * scale;
    const displayHeight = gridHeight * scale;

    return (
        <div className="min-h-screen bg-[#f8f7f5] flex flex-col relative overflow-hidden">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;700;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        
        body {
          font-family: 'Lexend', sans-serif;
        }
        
        .wood-texture {
          background-color: #eebb77;
          background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 2px, transparent 2px, transparent 8px), linear-gradient(to bottom, #deb887, #cd853f);
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        
        .btn-toy:active {
          transform: translateY(4px);
        }
        
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
        }
      `}</style>

            {/* Background Decoration */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-300 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-pink-300 rounded-full blur-3xl"></div>
            </div>

            {/* Top Navigation Bar */}
            <header className="relative z-20 w-full px-4 md:px-8 py-4 flex items-center justify-between">
                {/* Menu Button */}
                <button
                    onClick={() => setShowPauseMenu(true)}
                    className="group btn-toy flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-[#ff6b6b] rounded-2xl border-b-4 border-r-4 border-[#c92a2a] shadow-[0_6px_0px_0px_rgba(0,0,0,0.15)] hover:brightness-110 transition-all active:shadow-[0_2px_0px_0px_rgba(0,0,0,0.15)]"
                >
                    <span className="material-symbols-outlined text-white text-2xl md:text-4xl font-bold">grid_view</span>
                </button>

                {/* Game Title & Progress */}
                <div className="hidden md:flex flex-col items-center">
                    <h1 className="text-xl lg:text-3xl font-black text-[#5d4037] tracking-wide drop-shadow-sm">
                        WOOD PUZZLE LAND
                    </h1>
                    <div className="flex gap-1 mt-1">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-colors ${i < Math.floor(progress / 25) ? 'bg-[#f49d25]' : 'bg-gray-300'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Timer */}
                <div className="flex items-center wood-texture px-4 md:px-6 py-2 md:py-3 rounded-full border-4 border-[#8b4513] shadow-lg transform -rotate-1">
                    <span className="material-symbols-outlined text-[#5d4037] mr-2 text-xl md:text-3xl">schedule</span>
                    <span className="text-lg md:text-2xl font-black text-[#5d4037] tabular-nums">
                        {timer.formatTime()}
                    </span>
                </div>
            </header>

            {/* Main Game Area */}
            <main className="relative z-10 flex-1 flex w-full h-full overflow-hidden p-2 md:p-8 gap-4 md:gap-8 items-center justify-center">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    {/* Left: Puzzle Board Area */}
                    <div className="flex-1 h-full max-h-[800px] max-w-[800px] flex items-center justify-center">
                        <div className="relative w-full aspect-square bg-[#8b4513] rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-2xl border-4 border-[#5d4037]">
                            {/* Inner Board (Sky) */}
                            <div className="w-full h-full bg-[#87CEEB] rounded-xl md:rounded-2xl shadow-[inset_0_4px_12px_rgba(0,0,0,0.3)] relative overflow-hidden">
                                {/* Decor: Sun */}
                                <div className="absolute top-2 md:top-4 right-2 md:right-4 animate-float opacity-30">
                                    <svg fill="none" height="40" viewBox="0 0 100 100" width="40" xmlns="http://www.w3.org/2000/svg" className="md:w-20 md:h-20">
                                        <circle cx="50" cy="50" fill="#FFD700" r="30"></circle>
                                        <path d="M50 10V0M50 100V90M10 50H0M100 50H90M22 22L15 15M85 85L78 78M22 78L15 85M85 15L78 22" stroke="#FFD700" strokeLinecap="round" strokeWidth="8"></path>
                                    </svg>
                                </div>

                                {/* Puzzle Area */}
                                <div
                                    className="absolute inset-4 md:inset-8 flex items-center justify-center"
                                    style={{
                                        padding: usePuzzleShapes ? `${Math.max(tabPadding * 2, 20)}px` : '12px',
                                    }}
                                >
                                    <div
                                        className="relative bg-white/20 rounded-lg"
                                        style={{
                                            width: `${displayWidth}px`,
                                            height: `${displayHeight}px`,
                                        }}
                                    >
                                        {/* Background guide image */}
                                        {showGuideImage && backgroundImageUrl && (
                                            <img
                                                src={backgroundImageUrl}
                                                alt="Guide"
                                                className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-lg"
                                                style={{
                                                    opacity: guideOpacity,
                                                    zIndex: 0,
                                                }}
                                            />
                                        )}

                                        {/* Grid container */}
                                        <div
                                            className="relative"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'grid',
                                                gridTemplateColumns: `repeat(${cols}, ${pieceWidth * scale}px)`,
                                                gridTemplateRows: `repeat(${rows}, ${pieceHeight * scale}px)`,
                                                gap: '0px',
                                                overflow: 'visible',
                                                zIndex: 1,
                                            }}
                                        >
                                            {gridItems.map((id, index) => (
                                                <DroppableSlot
                                                    key={index}
                                                    index={index}
                                                    piece={pieces.find(p => p.id === id) || null}
                                                    totalCols={cols}
                                                    totalRows={rows}
                                                    baseWidth={pieceWidth * scale}
                                                    baseHeight={pieceHeight * scale}
                                                    showOutline={usePuzzleShapes}
                                                    tabPattern={pieces.length > 0 ? generateTabPattern(rows, cols) : undefined}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Wooden Frame Details (Screw heads) */}
                            <div className="absolute top-2 left-2 w-2 h-2 md:w-3 md:h-3 rounded-full bg-[#3e2723] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"></div>
                            <div className="absolute top-2 right-2 w-2 h-2 md:w-3 md:h-3 rounded-full bg-[#3e2723] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"></div>
                            <div className="absolute bottom-2 left-2 w-2 h-2 md:w-3 md:h-3 rounded-full bg-[#3e2723] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"></div>
                            <div className="absolute bottom-2 right-2 w-2 h-2 md:w-3 md:h-3 rounded-full bg-[#3e2723] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"></div>
                        </div>
                    </div>

                    {/* Right: Pieces Sidebar (Desktop) */}
                    <aside
                        id="pool"
                        className="hidden lg:flex flex-col w-64 h-full max-h-[800px] bg-white rounded-3xl border-4 border-[#f49d25]/20 p-4 shadow-xl overflow-y-auto"
                    >
                        <h2 className="text-center text-xl font-bold text-[#f49d25] mb-4 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined">extension</span>
                            Pieces ({poolItems.length})
                        </h2>
                        <div className="grid grid-cols-2 gap-4 pb-4">
                            {poolItems.map(id => {
                                const piece = pieces.find(p => p.id === id);
                                return piece ? (
                                    <div key={id} className="w-full aspect-square bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-2">
                                        <DraggablePiece id={id} src={piece.src} />
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </aside>

                    <DragOverlay dropAnimation={null}>
                        {activePiece && (
                            <div
                                className="shadow-2xl overflow-visible flex items-center justify-center"
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))',
                                }}
                            >
                                <img
                                    src={activePiece.src}
                                    className="max-w-full max-h-full object-contain"
                                    draggable={false}
                                />
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </main>

            {/* Floating Action Button for Mobile (Pieces Drawer Toggle) */}
            <div className="lg:hidden fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => setShowPiecesDrawer(!showPiecesDrawer)}
                    className="btn-toy flex items-center justify-center w-16 h-16 bg-[#f49d25] rounded-full border-b-4 border-[#e65100] shadow-[0_6px_0px_0px_rgba(0,0,0,0.15)] text-white active:shadow-[0_2px_0px_0px_rgba(0,0,0,0.15)]"
                >
                    <span className="material-symbols-outlined text-3xl">extension</span>
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {poolItems.length}
                    </div>
                </button>
            </div>

            {/* Mobile Pieces Drawer */}
            {showPiecesDrawer && (
                <div
                    className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowPiecesDrawer(false)}
                >
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[3rem] p-6 max-h-[70vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-[#f49d25] flex items-center gap-2">
                                <span className="material-symbols-outlined">extension</span>
                                Pieces ({poolItems.length})
                            </h2>
                            <button
                                onClick={() => setShowPiecesDrawer(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <span className="material-symbols-outlined text-3xl">close</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {poolItems.map(id => {
                                const piece = pieces.find(p => p.id === id);
                                return piece ? (
                                    <div key={id} className="w-full aspect-square bg-gray-50 rounded-xl shadow-md p-2">
                                        <DraggablePiece id={id} src={piece.src} />
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Pause Menu Modal */}
            {showPauseMenu && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#fff8e1] w-full max-w-md rounded-[3rem] p-8 border-8 border-[#f49d25] shadow-2xl relative animate-float">
                        <button
                            onClick={() => setShowPauseMenu(false)}
                            className="absolute -top-6 -right-6 bg-red-500 text-white rounded-full p-3 border-4 border-white shadow-lg hover:scale-110 transition-transform"
                        >
                            <span className="material-symbols-outlined text-3xl font-bold">close</span>
                        </button>
                        <h2 className="text-4xl font-black text-center text-[#5d4037] mb-8 drop-shadow-sm">
                            PAUSED
                        </h2>
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    setShowPauseMenu(false);
                                    timer.start();
                                }}
                                className="btn-toy w-full py-4 bg-[#8bc34a] rounded-2xl border-b-4 border-r-4 border-[#558b2f] shadow-[0_6px_0px_0px_rgba(0,0,0,0.15)] text-white text-2xl font-bold flex items-center justify-center gap-3 active:shadow-[0_2px_0px_0px_rgba(0,0,0,0.15)]"
                            >
                                <span className="material-symbols-outlined text-4xl">play_arrow</span>
                                RESUME
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-toy w-full py-4 bg-[#ffa726] rounded-2xl border-b-4 border-r-4 border-[#ef6c00] shadow-[0_6px_0px_0px_rgba(0,0,0,0.15)] text-white text-2xl font-bold flex items-center justify-center gap-3 mt-4 active:shadow-[0_2px_0px_0px_rgba(0,0,0,0.15)]"
                            >
                                <span className="material-symbols-outlined text-4xl">refresh</span>
                                RESTART
                            </button>
                        </div>
                        <div className="mt-6 text-center">
                            <div className="text-sm text-[#5d4037]/70">Time Elapsed</div>
                            <div className="text-2xl font-bold text-[#5d4037]">{timer.formatTime()}</div>
                            <div className="text-sm text-[#5d4037]/70 mt-2">Pieces Placed</div>
                            <div className="text-2xl font-bold text-[#5d4037]">{completedPieces} / {totalSlots}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {isSolved && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#fff8e1] w-full max-w-md rounded-[3rem] p-8 border-8 border-[#8bc34a] shadow-2xl relative animate-float">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🎉</div>
                            <h2 className="text-4xl font-black text-[#5d4037] mb-4">
                                PUZZLE COMPLETE!
                            </h2>
                            <div className="text-lg text-[#5d4037]/70 mb-2">Finished in</div>
                            <div className="text-3xl font-bold text-[#5d4037] mb-6">{timer.formatTime()}</div>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-toy w-full py-4 bg-[#29b6f6] rounded-2xl border-b-4 border-r-4 border-[#0277bd] shadow-[0_6px_0px_0px_rgba(0,0,0,0.15)] text-white text-2xl font-bold flex items-center justify-center gap-3 active:shadow-[0_2px_0px_0px_rgba(0,0,0,0.15)]"
                            >
                                <span className="material-symbols-outlined text-4xl">replay</span>
                                PLAY AGAIN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}