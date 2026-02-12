// components/PuzzleGameImproved.tsx
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

// Generate puzzle piece path - EXTRA SMALL tabs
function generatePuzzlePath(
    width: number,
    height: number,
    row: number,
    col: number,
    rows: number,
    cols: number,
    tabPattern: { horizontal: boolean[][]; vertical: boolean[][] }
): string {
    // EXTRA SMALL tab for ZERO visual gap
    const tabSize = Math.min(width, height) * 0.06;
    const tabDepth = tabSize * 0.7;

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
        path += ` L ${width * 0.44},0`;
        path += ` C ${width * 0.44},${-tabDepth * 0.25} ${width * 0.47},${-tabDepth} ${width * 0.5},${-tabDepth}`;
        path += ` C ${width * 0.53},${-tabDepth} ${width * 0.56},${-tabDepth * 0.25} ${width * 0.56},0`;
        path += ` L ${width},0`;
    } else if (hasTopSlot) {
        path += ` L ${width * 0.44},0`;
        path += ` C ${width * 0.44},${tabDepth * 0.25} ${width * 0.47},${tabDepth} ${width * 0.5},${tabDepth}`;
        path += ` C ${width * 0.53},${tabDepth} ${width * 0.56},${tabDepth * 0.25} ${width * 0.56},0`;
        path += ` L ${width},0`;
    } else {
        path += ` L ${width},0`;
    }

    // Right edge
    if (hasRightTab) {
        path += ` L ${width},${height * 0.44}`;
        path += ` C ${width + tabDepth * 0.25},${height * 0.44} ${width + tabDepth},${height * 0.47} ${width + tabDepth},${height * 0.5}`;
        path += ` C ${width + tabDepth},${height * 0.53} ${width + tabDepth * 0.25},${height * 0.56} ${width},${height * 0.56}`;
        path += ` L ${width},${height}`;
    } else if (hasRightSlot) {
        path += ` L ${width},${height * 0.44}`;
        path += ` C ${width - tabDepth * 0.25},${height * 0.44} ${width - tabDepth},${height * 0.47} ${width - tabDepth},${height * 0.5}`;
        path += ` C ${width - tabDepth},${height * 0.53} ${width - tabDepth * 0.25},${height * 0.56} ${width},${height * 0.56}`;
        path += ` L ${width},${height}`;
    } else {
        path += ` L ${width},${height}`;
    }

    // Bottom edge
    if (hasBottomTab) {
        path += ` L ${width * 0.56},${height}`;
        path += ` C ${width * 0.56},${height + tabDepth * 0.25} ${width * 0.53},${height + tabDepth} ${width * 0.5},${height + tabDepth}`;
        path += ` C ${width * 0.47},${height + tabDepth} ${width * 0.44},${height + tabDepth * 0.25} ${width * 0.44},${height}`;
        path += ` L 0,${height}`;
    } else if (hasBottomSlot) {
        path += ` L ${width * 0.56},${height}`;
        path += ` C ${width * 0.56},${height - tabDepth * 0.25} ${width * 0.53},${height - tabDepth} ${width * 0.5},${height - tabDepth}`;
        path += ` C ${width * 0.47},${height - tabDepth} ${width * 0.44},${height - tabDepth * 0.25} ${width * 0.44},${height}`;
        path += ` L 0,${height}`;
    } else {
        path += ` L 0,${height}`;
    }

    // Left edge
    if (hasLeftTab) {
        path += ` L 0,${height * 0.56}`;
        path += ` C ${-tabDepth * 0.25},${height * 0.56} ${-tabDepth},${height * 0.53} ${-tabDepth},${height * 0.5}`;
        path += ` C ${-tabDepth},${height * 0.47} ${-tabDepth * 0.25},${height * 0.44} 0,${height * 0.44}`;
        path += ` L 0,0`;
    } else if (hasLeftSlot) {
        path += ` L 0,${height * 0.56}`;
        path += ` C ${tabDepth * 0.25},${height * 0.56} ${tabDepth},${height * 0.53} ${tabDepth},${height * 0.5}`;
        path += ` C ${tabDepth},${height * 0.47} ${tabDepth * 0.25},${height * 0.44} 0,${height * 0.44}`;
        path += ` L 0,0`;
    } else {
        path += ` L 0,0`;
    }

    path += ` Z`;
    return path;
}

// Split image
async function splitImage(
    imageSrc: string,
    rows: number,
    cols: number,
    usePuzzleShapes: boolean = false
): Promise<{ pieces: Piece[]; imageWidth: number; imageHeight: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageSrc;

        img.onload = () => {
            const pieceWidth = img.width / cols;
            const pieceHeight = img.height / rows;
            const pieces: Piece[] = [];

            const tabPattern = generateTabPattern(rows, cols);

            const tabSize = Math.min(pieceWidth, pieceHeight) * 0.06;
            const tabDepth = tabSize * 0.7;
            const padding = usePuzzleShapes ? tabDepth * 1.0 : 0;

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

                        // NO BORDER - untuk seamless maksimal
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
                    });
                }
            }
            resolve({ pieces, imageWidth: img.width, imageHeight: img.height });
        };

        img.onerror = () => reject(new Error('Gagal load gambar'));
    });
}

// Draggable Piece Component
function DraggablePiece({ id, src, isInGrid = false }: { id: string; src: string; isInGrid?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.7 : 1,
        scale: isDragging ? 1.05 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="w-full h-full flex items-center justify-center"
        >
            <img
                src={src}
                alt=""
                className="max-w-full max-h-full object-contain pointer-events-none"
                style={{ display: 'block' }}
            />
        </div>
    );
}

// Droppable Slot with ULTRA negative margins
function DroppableSlot({
    index,
    pieceId,
    pieceSrc,
    rows,
    cols,
    usePuzzleShapes
}: {
    index: number;
    pieceId: string;
    pieceSrc: string | undefined;
    rows: number;
    cols: number;
    usePuzzleShapes: boolean;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
    const isEmpty = pieceId === '';

    const row = Math.floor(index / cols);
    const col = index % cols;

    // ULTRA AGGRESSIVE negative margins untuk ZERO gap
    const marginStyle = usePuzzleShapes ? {
        marginTop: row > 0 ? '-6%' : '0',
        marginLeft: col > 0 ? '-6%' : '0',
        marginRight: col < cols - 1 ? '-6%' : '0',
        marginBottom: row < rows - 1 ? '-6%' : '0',
        position: 'relative' as const,
        zIndex: isEmpty ? 0 : 10,
    } : {};

    return (
        <div
            ref={setNodeRef}
            id={`slot-${index}`}
            className={`aspect-square flex items-center justify-center ${isEmpty
                ? isOver
                    ? 'bg-green-100/50'
                    : 'bg-transparent'
                : ''
                }`}
            style={{
                padding: 0,
                margin: 0,
                overflow: 'visible',
                ...marginStyle
            }}
        >
            {!isEmpty && pieceId && (
                <DraggablePiece id={pieceId} src={pieceSrc || ''} isInGrid />
            )}
        </div>
    );
}

export default function PuzzleGame({
    imageSrc = '/assets1000.jpg',
    rows = 3,
    cols = 3,
    mode = 'partial' as PuzzleMode,
    usePuzzleShapes = false,
}) {
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [gridItems, setGridItems] = useState<string[]>(Array(rows * cols).fill(''));
    const [poolItems, setPoolItems] = useState<string[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSolved, setIsSolved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    const totalSlots = rows * cols;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const { pieces: splitPieces, imageWidth, imageHeight } = await splitImage(
                    imageSrc,
                    rows,
                    cols,
                    usePuzzleShapes
                );
                setPieces(splitPieces);
                setImageDimensions({ width: imageWidth, height: imageHeight });

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
            if (correct) {
                setIsSolved(true);
                setTimeout(() => alert('Puzzle selesai! 🎉'), 300);
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
                alert('Slot sudah terisi!');
                return;
            }
            if (piece.correctIndex !== targetIndex) {
                alert('Posisi salah!');
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

    if (loading) return <div className="p-10 text-center">Memuat puzzle...</div>;

    const gridAspectRatio = imageDimensions.width / imageDimensions.height;

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-center mb-2">
                Puzzle {mode === 'partial' ? '(Lengkapi yang Ada)' : '(Susun dari Nol)'}
            </h1>
            <p className="text-center text-gray-600 mb-6">
                {usePuzzleShapes ? '🧩 Mode: ZERO GAP - Ultra Seamless' : '📐 Mode: Rectangle Pieces'}
            </p>

            {isSolved && (
                <div className="bg-green-100 p-6 mb-6 rounded text-center text-2xl font-bold">
                    Puzzle Selesai! 🎉
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-4">Area Puzzle</h2>
                        <div
                            className="grid mx-auto"
                            style={{
                                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                maxWidth: '600px',
                                gap: '0',
                                aspectRatio: `${gridAspectRatio}`,
                                padding: 0,
                                margin: 0,
                                overflow: 'visible',
                                background: 'transparent',
                            }}
                        >
                            {gridItems.map((id, index) => (
                                <DroppableSlot
                                    key={index}
                                    index={index}
                                    pieceId={id}
                                    pieceSrc={pieces.find(p => p.id === id)?.src}
                                    rows={rows}
                                    cols={cols}
                                    usePuzzleShapes={usePuzzleShapes}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 max-w-md">
                        <h2 className="text-xl font-semibold mb-4">
                            Piece Tersisa ({poolItems.length})
                        </h2>
                        <div
                            id="pool"
                            className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4 border-2 border-dashed border-gray-400 rounded-lg min-h-[200px] bg-gray-50"
                        >
                            {poolItems.map(id => {
                                const piece = pieces.find(p => p.id === id);
                                return piece ? (
                                    <div key={id} className="w-full aspect-square">
                                        <DraggablePiece id={id} src={piece.src} />
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>
                </div>

                <DragOverlay dropAnimation={null}>
                    {activePiece && (
                        <div className="w-24 h-24 shadow-xl overflow-visible opacity-90 flex items-center justify-center">
                            <img src={activePiece.src} className="max-w-full max-h-full object-contain drop-shadow-lg" />
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            <div className="text-center mt-10 space-x-4">
                <button
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                >
                    Main Ulang
                </button>
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg text-sm text-gray-700 border-2 border-red-200">
                <p className="font-semibold mb-2 text-red-700">🔥 ZERO GAP - ULTRA SEAMLESS!</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>⚡ <strong>Tab size: 0.06</strong> (smallest possible)</li>
                    <li>⚡ <strong>Negative margin: -6%</strong> (ultra aggressive)</li>
                    <li>⚡ <strong>NO BORDER</strong>: Tanpa border untuk seamless total</li>
                    <li>⚡ <strong>Transparent background</strong>: Grid tanpa warna</li>
                    <li>⚡ <strong>Overflow visible</strong>: Pieces bebas overlap</li>
                    <li>🎉 <strong>ZERO GAP GUARANTEE!</strong></li>
                </ul>
            </div>
        </div>
    );
}