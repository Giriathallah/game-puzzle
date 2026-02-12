"use client";
import React, { useState, useEffect, useRef } from 'react';
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

// Split image dengan padding yang konsisten untuk semua aspect ratio
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

// Draggable Piece untuk sidebar
function DraggableSidebarPiece({
    id,
    src,
    isCompleted = false,
}: {
    id: string;
    src: string;
    isCompleted?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        disabled: isCompleted
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    if (isCompleted) {
        return (
            <div className="stagger-item w-36 aspect-square rounded-3xl bg-white/40 border-4 border-dashed border-blue-200 flex items-center justify-center shadow-inner shrink-0">
                <svg className="w-16 h-16 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="stagger-item group draggable relative w-36 aspect-square rounded-3xl overflow-hidden shadow-cloud hover:shadow-xl hover:scale-110 transition-all duration-300 bg-white ring-4 ring-white cursor-grab shrink-0"
        >
            <img
                src={src}
                alt="Puzzle piece"
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
            />
            <div className="absolute top-3 right-3 bg-accent-yellow rounded-full w-5 h-5 border-2 border-white shadow-sm"></div>
        </div>
    );
}

// Draggable Piece untuk grid
function DraggablePiece({
    id,
    src,
    padding = 0,
    baseWidth = 100,
    baseHeight = 100,
}: {
    id: string;
    src: string;
    padding?: number;
    baseWidth?: number;
    baseHeight?: number;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const totalWidth = baseWidth + padding * 2;
    const totalHeight = baseHeight + padding * 2;

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.8 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'absolute' as const,
        width: `${totalWidth}px`,
        height: `${totalHeight}px`,
        left: `${-padding}px`,
        top: `${-padding}px`,
        pointerEvents: 'auto' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="flex items-center justify-center"
        >
            <img
                src={src}
                alt=""
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
            />
        </div>
    );
}

// Droppable Slot
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
            className={`relative transition-colors ${isEmpty ? (isOver ? 'bg-green-200/40' : '') : ''}`}
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
                        stroke="rgba(0, 0, 0, 0.3)"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                    />
                </svg>
            )}

            {piece && (
                <DraggablePiece
                    id={piece.id}
                    src={piece.src}
                    padding={piece.padding * (baseWidth / piece.baseWidth)}
                    baseWidth={baseWidth}
                    baseHeight={baseHeight}
                />
            )}
        </div>
    );
}

export default function PuzzleGame({
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
    const [tabPadding, setTabPadding] = useState(0);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
    const [timeRemaining, setTimeRemaining] = useState(timeLimit);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMusicOn, setIsMusicOn] = useState(true);
    const [isSfxOn, setIsSfxOn] = useState(true);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Audio refs
    const bgMusicRef = useRef<HTMLAudioElement | null>(null);
    const sfxCorrectRef = useRef<HTMLAudioElement | null>(null);
    const sfxFalseRef = useRef<HTMLAudioElement | null>(null);
    const sfxFailRef = useRef<HTMLAudioElement | null>(null);
    const sfxCompleteRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio elements
    useEffect(() => {
        bgMusicRef.current = new Audio('/sfx/bg-music.mp3');
        bgMusicRef.current.loop = true;
        bgMusicRef.current.volume = 0.4;

        sfxCorrectRef.current = new Audio('/sfx/correct.mp3');
        sfxFalseRef.current = new Audio('/sfx/false.mp3');
        sfxFailRef.current = new Audio('/sfx/fail.mp3');
        sfxCompleteRef.current = new Audio('/sfx/complete-puzzle.mp3');

        return () => {
            bgMusicRef.current?.pause();
            bgMusicRef.current = null;
        };
    }, []);

    // Play/pause background music based on isMusicOn, isPaused, isSolved, isGameOver
    useEffect(() => {
        if (!bgMusicRef.current) return;
        if (isMusicOn && !isSolved && !isGameOver) {
            bgMusicRef.current.play().catch(() => { });
        } else {
            bgMusicRef.current.pause();
        }
    }, [isMusicOn, isSolved, isGameOver]);

    // Helper to play SFX
    const playSfx = (audioRef: React.RefObject<HTMLAudioElement | null>) => {
        if (!isSfxOn || !audioRef.current) return;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { });
    };

    const totalSlots = rows * cols;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    // Timer countdown
    useEffect(() => {
        if (loading || isSolved || isGameOver || isPaused) return;

        timerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    setIsGameOver(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading, isSolved, isGameOver, isPaused]);

    // Format waktu
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

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
                if (timerRef.current) clearInterval(timerRef.current);
                bgMusicRef.current?.pause();
                playSfx(sfxCompleteRef);
            }
        }
    }, [gridItems, poolItems, pieces, isSolved, isSfxOn]);

    // Play fail SFX when game over (time ran out)
    useEffect(() => {
        if (isGameOver && !isSolved) {
            bgMusicRef.current?.pause();
            playSfx(sfxFailRef);
        }
    }, [isGameOver, isSolved, isSfxOn]);

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
                playSfx(sfxFalseRef);
                return;
            }
            if (piece.correctIndex !== targetIndex) {
                playSfx(sfxFalseRef);
                return;
            }

            // Correct placement!
            playSfx(sfxCorrectRef);
            setGridItems(prev => {
                const newGrid = [...prev];
                newGrid[targetIndex] = activePieceId;
                return newGrid;
            });
            setPoolItems(prev => prev.filter(id => id !== activePieceId));
        }
    };

    const activePiece = activeId ? pieces.find(p => p.id === activeId) : null;

    if (loading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-sky-blue to-grass-green">
                <div className="text-2xl font-bold text-slate-700">Memuat puzzle...</div>
            </div>
        );
    }

    const pieceWidth = pieces.length > 0 ? pieces[0].baseWidth : 100;
    const pieceHeight = pieces.length > 0 ? pieces[0].baseHeight : 100;
    const gridWidth = pieceWidth * cols;
    const gridHeight = pieceHeight * rows;

    const maxDisplayWidth = 550;
    const maxDisplayHeight = 550;
    const scale = Math.min(1, maxDisplayWidth / gridWidth, maxDisplayHeight / gridHeight);
    const displayWidth = gridWidth * scale;
    const displayHeight = gridHeight * scale;

    const remainingPieces = poolItems.length;

    return (
        <div className="w-screen h-screen overflow-hidden font-display text-slate-600 bg-gray-800">
            <style>{`
        body {
          margin: 0;
          overflow: hidden;
          cursor: default;
        }
        .game-container {
          width: 100vw;
          height: 100vh;
          max-width: 1600px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #e0f2fe 0%, #dcfce7 100%);
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-left: 1px solid rgba(255, 255, 255, 0.4);
        }
        .puzzle-tray-thick {
          background-color: #ffffff;
          border-radius: 60px;
          box-shadow: 
            0 40px 80px -20px rgba(0, 0, 0, 0.3),
            0 10px 20px -5px rgba(0, 0, 0, 0.1),
            inset 0 -10px 0 0 #e2e8f0,
            inset 0 4px 12px 0 rgba(255,255,255, 1);
          border: 1px solid #f1f5f9;
          padding: 24px;
        }
        .puzzle-well {
          background-color: #f1f5f9;
          border-radius: 40px;
          box-shadow: 
            inset 0 6px 15px rgba(0, 0, 0, 0.12),
            inset 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(74, 222, 128, 0.4);
          border-radius: 4px;
        }
        .sidebar-shape {
          border-top-left-radius: 60px;
          border-bottom-left-radius: 60px;
        }
        .cloud-shape {
          background: white;
          border-radius: 100px;
          box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.15), inset 0 -5px 10px rgba(0,0,0,0.02);
          position: absolute;
        }
        @keyframes float-cloud {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .float-anim {
          animation: float-cloud 6s ease-in-out infinite;
        }
        .float-anim-delayed {
          animation: float-cloud 7s ease-in-out 1s infinite;
        }
        .stagger-item:nth-child(odd) {
          transform: rotate(3deg) translateX(4px);
        }
        .stagger-item:nth-child(even) {
          transform: rotate(-2deg) translateX(-4px);
        }
        .shadow-cloud {
          box-shadow: 0 8px 16px rgba(0,0,0,0.05), inset 0 -4px 8px rgba(0,0,0,0.02);
        }
        /* 3D Button Styles for Pause Menu */
        .btn-3d {
          transition: all 0.1s ease;
          position: relative;
          top: 0;
        }
        .btn-3d:active {
          transform: translateY(4px);
          border-bottom-width: 0px !important;
          margin-bottom: 4px;
        }
      `}</style>

            <div className="game-container">
                {/* Decorative elements */}
                <div className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                    style={{
                        backgroundImage: 'radial-gradient(#60a5fa 2px, transparent 2px)',
                        backgroundSize: '32px 32px'
                    }}>
                </div>

                {/* Clouds */}
                <div className="absolute top-[10%] left-[5%] w-32 h-12 cloud-shape float-anim z-0 opacity-80 pointer-events-none">
                    <div className="absolute -top-6 left-4 w-16 h-16 bg-white rounded-full"></div>
                    <div className="absolute -top-10 left-12 w-20 h-20 bg-white rounded-full"></div>
                </div>
                <div className="absolute top-[5%] right-[25%] w-40 h-14 cloud-shape float-anim-delayed z-0 opacity-60 pointer-events-none">
                    <div className="absolute -top-8 left-6 w-20 h-20 bg-white rounded-full"></div>
                    <div className="absolute -top-5 left-20 w-16 h-16 bg-white rounded-full"></div>
                </div>

                {/* Sun */}
                <div className="absolute top-10 right-[350px] pointer-events-none z-0">
                    <div className="w-16 h-16 xl:w-24 xl:h-24 bg-yellow-200 rounded-full shadow-[0_0_40px_rgba(253,224,71,0.6)] animate-pulse"></div>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="relative z-10 flex h-full w-full">
                        {/* Main puzzle area */}
                        <main className="flex-1 flex flex-col relative h-full items-center justify-center p-4 xl:p-8 order-1">
                            {/* Top navigation */}
                            <div className="absolute top-8 z-20 w-full flex justify-center pointer-events-none">
                                <div className="relative flex items-center gap-6 xl:gap-12 pointer-events-auto bg-white/40 backdrop-blur-sm py-3 xl:py-4 px-6 xl:px-10 rounded-full border border-white/60 shadow-sm">
                                    <div className="absolute inset-x-12 top-1/2 h-1 -mt-0.5 border-t-2 border-dashed border-slate-300 z-0"></div>

                                    <div className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm">
                                            <span className="material-icons-round text-slate-400 text-xl">home</span>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                        <div className="absolute -inset-2 bg-yellow-100/50 rounded-full animate-pulse z-0"></div>
                                        <div className="w-12 h-12 rounded-full bg-yellow-400 border-4 border-white flex items-center justify-center shadow-lg relative z-10 transform scale-110">
                                            <span className="material-icons-round text-white text-2xl drop-shadow-sm">extension</span>
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20">
                                            <span className="material-icons-round text-[10px]">star</span>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm">
                                            <span className="material-icons-round text-slate-400 text-xl">landscape</span>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm">
                                            <span className="material-icons-round text-slate-400 text-xl">emoji_events</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Puzzle board */}
                            <div className="relative z-10 transform transition-transform origin-center mt-8 xl:mt-12">
                                <div className="puzzle-tray-thick relative inline-block">
                                    {/* Decorative buttons */}
                                    <div className="absolute -top-4 -left-4 xl:-top-6 xl:-left-6 w-14 h-14 xl:w-20 xl:h-20 bg-pink-400 rounded-full border-4 xl:border-[6px] border-white shadow-lg z-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                                        <span className="material-icons-round text-white text-xl xl:text-3xl drop-shadow-md">favorite</span>
                                    </div>
                                    <div className="absolute -bottom-4 -right-4 xl:-bottom-6 xl:-right-6 w-14 h-14 xl:w-20 xl:h-20 bg-green-400 rounded-full border-4 xl:border-[6px] border-white shadow-lg z-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                                        <span className="material-icons-round text-white text-xl xl:text-3xl drop-shadow-md">star</span>
                                    </div>

                                    <div
                                        className="puzzle-well flex items-center justify-center overflow-hidden relative"
                                        style={{
                                            width: `${displayWidth + 48}px`,
                                            height: `${displayHeight + 48}px`,
                                            padding: usePuzzleShapes ? `${Math.max(tabPadding * 2, 30)}px` : '24px',
                                        }}
                                    >
                                        <div
                                            className="relative bg-white/30 rounded-lg"
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
                            </div>

                            {/* Game over overlay */}
                            {(isSolved || isGameOver) && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                                    <div className="bg-white rounded-3xl p-12 shadow-2xl text-center max-w-md">
                                        {isSolved ? (
                                            <>
                                                <div className="text-6xl mb-4">🎉</div>
                                                <h2 className="text-3xl font-bold text-slate-800 mb-2">Selamat!</h2>
                                                <p className="text-lg text-slate-600 mb-6">
                                                    Kamu berhasil menyelesaikan puzzle dalam waktu {formatTime(timeLimit - timeRemaining)}!
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-6xl mb-4">⏰</div>
                                                <h2 className="text-3xl font-bold text-slate-800 mb-2">Waktu Habis!</h2>
                                                <p className="text-lg text-slate-600 mb-6">
                                                    Coba lagi untuk menyelesaikan puzzle!
                                                </p>
                                            </>
                                        )}
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-medium transition-colors"
                                        >
                                            Main Lagi
                                        </button>
                                    </div>
                                </div>
                            )}
                        </main>

                        {/* Sidebar */}
                        <aside className="flex-shrink-0 w-[280px] xl:w-[360px] h-full relative z-20 order-2 flex">
                            <div className="w-full h-full sidebar-shape shadow-2xl overflow-hidden glass-panel flex flex-col relative">
                                {/* Header */}
                                <div className="pt-6 xl:pt-10 pb-4 xl:pb-6 px-5 xl:px-8 flex flex-col gap-4 xl:gap-6 z-10">
                                    <div className="flex items-center justify-between w-full">
                                        <button
                                            onClick={() => setIsPaused(true)}
                                            className="bg-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all text-blue-500 border border-blue-100 group"
                                        >
                                            <span className="material-icons-round text-3xl">menu</span>
                                        </button>
                                        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-sm border border-blue-100">
                                            <span className="material-icons-round text-green-400 text-3xl xl:text-4xl">timer</span>
                                            <span className={`text-3xl xl:text-4xl font-bold tracking-tight tabular-nums font-display ${timeRemaining < 30 ? 'text-red-600' : 'text-slate-700'
                                                }`}>
                                                {formatTime(timeRemaining)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Pieces remaining */}
                                    <div className="flex flex-col items-center justify-center w-full mt-2">
                                        <div className="bg-gradient-to-br from-white to-blue-50 w-full rounded-3xl p-5 shadow-sm border border-white/50 flex items-center justify-between px-6">
                                            <div className="flex flex-col items-start">
                                                <span className="text-4xl xl:text-5xl font-black text-slate-700 tracking-tight font-display leading-none">
                                                    {remainingPieces} / {totalSlots}
                                                </span>
                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-2">Tersisa</span>
                                            </div>
                                            <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-md rotate-3">
                                                <span className="material-icons-round text-4xl">extension</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Scrollable pieces area */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 xl:px-6 pb-6 xl:pb-8 relative z-10 w-full">
                                    <div className="flex flex-col gap-10 items-center pt-4">
                                        {poolItems.map((id) => {
                                            const piece = pieces.find(p => p.id === id);
                                            return piece ? (
                                                <DraggableSidebarPiece key={id} id={id} src={piece.src} />
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                {/* Bottom gradient */}
                                <div className="h-20 bg-gradient-to-t from-white/60 to-transparent pointer-events-none absolute bottom-0 w-full z-20 sidebar-shape rounded-t-none"></div>
                            </div>
                        </aside>
                    </div>

                    {/* Drag overlay */}
                    <DragOverlay dropAnimation={null}>
                        {activePiece && (
                            <div
                                className="shadow-2xl overflow-visible flex items-center justify-center rounded-3xl"
                                style={{
                                    width: '140px',
                                    height: '140px',
                                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
                                }}
                            >
                                <img
                                    src={activePiece.src}
                                    className="max-w-full max-h-full object-contain"
                                    draggable={false}
                                    alt="Dragging piece"
                                />
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>

                {/* Pause Menu Overlay */}
                {isPaused && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="w-full max-w-[400px] min-h-[500px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col items-center p-8 relative overflow-hidden border-4 border-white/20">
                            {/* Decorative gradient */}
                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-amber-500/10 to-transparent"></div>

                            {/* Header */}
                            <div className="relative z-10 flex flex-col items-center mb-8 w-full">
                                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 animate-[spin_10s_linear_infinite]">
                                    <span className="material-icons-round text-amber-500 text-4xl">settings</span>
                                </div>
                                <h1 className="text-4xl font-bold text-neutral-800 tracking-wide">Menu</h1>
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-col w-full gap-5 z-10">
                                {/* Resume */}
                                <button
                                    onClick={() => setIsPaused(false)}
                                    className="btn-3d w-full group relative flex items-center justify-between px-6 py-4 bg-green-400 hover:bg-green-500 border-b-[6px] border-green-500 rounded-full text-white transition-colors"
                                >
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">play_arrow</span>
                                    </div>
                                    <span className="flex-grow text-center text-xl font-bold mr-8">Lanjutkan</span>
                                </button>

                                {/* Music Toggle */}
                                <button
                                    onClick={() => setIsMusicOn(!isMusicOn)}
                                    className="btn-3d w-full group relative flex items-center justify-between px-6 py-4 bg-sky-400 hover:bg-sky-500 border-b-[6px] border-sky-500 rounded-full text-white transition-colors"
                                >
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">music_note</span>
                                    </div>
                                    <span className="flex-grow text-center text-xl font-bold">Musik</span>
                                    <div className="bg-white/20 px-3 py-1 rounded-lg text-sm font-bold ml-2">{isMusicOn ? 'ON' : 'OFF'}</div>
                                </button>

                                {/* SFX Toggle */}
                                <button
                                    onClick={() => setIsSfxOn(!isSfxOn)}
                                    className="btn-3d w-full group relative flex items-center justify-between px-6 py-4 bg-amber-500 hover:bg-amber-600 border-b-[6px] border-amber-600 rounded-full text-white transition-colors"
                                >
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">{isSfxOn ? 'volume_up' : 'volume_off'}</span>
                                    </div>
                                    <span className="flex-grow text-center text-xl font-bold">Suara</span>
                                    <div className="bg-white/20 px-3 py-1 rounded-lg text-sm font-bold ml-2">{isSfxOn ? 'ON' : 'OFF'}</div>
                                </button>

                                {/* Exit */}
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="btn-3d w-full mt-2 group relative flex items-center justify-between px-6 py-4 bg-red-400 hover:bg-red-500 border-b-[6px] border-red-500 rounded-full text-white transition-colors"
                                >
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">home</span>
                                    </div>
                                    <span className="flex-grow text-center text-xl font-bold mr-8">Keluar</span>
                                </button>
                            </div>

                            {/* Footer */}
                            <div className="mt-auto pt-6 text-neutral-400 text-sm font-medium">
                                Puzzle Jigsaw
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}