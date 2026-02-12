'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types
type Point = { x: number; y: number };

type Piece = {
    id: string;
    row: number;
    col: number;
    triangleIndex: number;
    src: string;
    correctPosition: Point;
    polygon: Point[];
    width: number;
    height: number;
    neighbors: {
        [key: string]: string | null;
    };
};

type PlacedPiece = {
    id: string;
    position: Point;
    isLocked: boolean;
    connectedGroup: Set<string>;
};

type DragState = {
    pieceIds: string[];
    offset: Point;
};

// Calculate distance between two points
function distance(p1: Point, p2: Point): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Get polygon bounds
function getPolygonBounds(polygon: Point[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number
} {
    const xs = polygon.map(p => p.x);
    const ys = polygon.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Generate varied triangle patterns by splitting each cell into 4 triangles
// from a varied interior point — creates visual variety with no degenerate triangles
function generateTrianglePattern(
    topLeft: Point,
    topRight: Point,
    bottomLeft: Point,
    bottomRight: Point,
    row: number,
    col: number
): Point[][] {
    const cellW = topRight.x - topLeft.x;
    const cellH = bottomLeft.y - topLeft.y;

    // Deterministic varied interior point position based on row/col
    // Each position is at least 25% from any edge to ensure decent-sized triangles
    const patternType = (row * 7 + col * 13) % 6;
    let cx: number, cy: number;

    switch (patternType) {
        case 0: cx = 0.50; cy = 0.50; break; // dead center
        case 1: cx = 0.30; cy = 0.35; break; // upper-left bias
        case 2: cx = 0.70; cy = 0.30; break; // upper-right bias
        case 3: cx = 0.30; cy = 0.70; break; // lower-left bias
        case 4: cx = 0.70; cy = 0.65; break; // lower-right bias
        case 5: cx = 0.40; cy = 0.60; break; // slightly off-center
        default: cx = 0.50; cy = 0.50; break;
    }

    const interior: Point = {
        x: topLeft.x + cellW * cx,
        y: topLeft.y + cellH * cy,
    };

    // Fan-split into 4 triangles from interior point to each edge
    return [
        [topLeft, topRight, interior],
        [topRight, bottomRight, interior],
        [bottomRight, bottomLeft, interior],
        [bottomLeft, topLeft, interior],
    ];
}

// Create triangle mesh
async function createTrianglePuzzle(
    imageSrc: string,
    rows: number,
    cols: number,
    maxImageSize: number = 800
): Promise<{ pieces: Piece[]; imageWidth: number; imageHeight: number; scale: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onerror = () => {
            console.error('Failed to load image:', imageSrc);
            reject(new Error(`Failed to load image: ${imageSrc}`));
        };

        img.onload = () => {
            try {
                console.log('Image loaded successfully:', img.width, 'x', img.height);

                const maxDimension = Math.max(img.width, img.height);
                const imageScale = maxDimension > maxImageSize ? maxImageSize / maxDimension : 1;

                const width = img.width * imageScale;
                const height = img.height * imageScale;

                const cellWidth = width / cols;
                const cellHeight = height / rows;

                const pieces: Piece[] = [];
                const allTriangles: { triangle: Point[]; row: number; col: number; index: number }[] = [];

                // Generate all triangles
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const topLeft = { x: col * cellWidth, y: row * cellHeight };
                        const topRight = { x: (col + 1) * cellWidth, y: row * cellHeight };
                        const bottomLeft = { x: col * cellWidth, y: (row + 1) * cellHeight };
                        const bottomRight = { x: (col + 1) * cellWidth, y: (row + 1) * cellHeight };

                        const triangles = generateTrianglePattern(topLeft, topRight, bottomLeft, bottomRight, row, col);

                        triangles.forEach((triangle, index) => {
                            allTriangles.push({ triangle, row, col, index });
                        });
                    }
                }

                // Create pieces
                allTriangles.forEach(({ triangle, row, col, index }) => {
                    try {
                        const piece = createTrianglePiece(img, triangle, row, col, index, imageScale);
                        if (piece && piece.src) {
                            pieces.push(piece);
                        } else {
                            console.warn('Failed to create piece:', row, col, index);
                        }
                    } catch (err) {
                        console.error('Error creating piece:', row, col, index, err);
                    }
                });

                if (pieces.length === 0) {
                    reject(new Error('No pieces were created'));
                    return;
                }

                console.log(`Created ${pieces.length} pieces successfully`);

                // Set up neighbor relationships with proper tolerance
                setupNeighbors(pieces, 1.0);

                resolve({ pieces, imageWidth: width, imageHeight: height, scale: imageScale });
            } catch (err) {
                console.error('Error in createTrianglePuzzle:', err);
                reject(err);
            }
        };

        img.src = imageSrc;
    });
}

function createTrianglePiece(
    img: HTMLImageElement,
    triangle: Point[],
    row: number,
    col: number,
    triangleIndex: number,
    imageScale: number
): Piece {
    const bounds = getPolygonBounds(triangle);

    const padding = 2;
    const canvasWidth = Math.ceil(bounds.width + padding * 2);
    const canvasHeight = Math.ceil(bounds.height + padding * 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false
    });

    if (!ctx) throw new Error('Could not get canvas context');

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Translate triangle to canvas coordinates
    const offsetTriangle = triangle.map(p => ({
        x: p.x - bounds.minX + padding,
        y: p.y - bounds.minY + padding
    }));

    // Clip to triangle shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(offsetTriangle[0].x, offsetTriangle[0].y);
    for (let i = 1; i < offsetTriangle.length; i++) {
        ctx.lineTo(offsetTriangle[i].x, offsetTriangle[i].y);
    }
    ctx.closePath();
    ctx.clip();

    // Draw image
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Calculate source coordinates in original image
    const srcX = (bounds.minX - padding) / imageScale;
    const srcY = (bounds.minY - padding) / imageScale;
    const srcWidth = canvasWidth / imageScale;
    const srcHeight = canvasHeight / imageScale;

    ctx.drawImage(
        img,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    ctx.restore();

    // Subtle border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(offsetTriangle[0].x, offsetTriangle[0].y);
    for (let i = 1; i < offsetTriangle.length; i++) {
        ctx.lineTo(offsetTriangle[i].x, offsetTriangle[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    return {
        id: `piece-${row}-${col}-${triangleIndex}`,
        row,
        col,
        triangleIndex,
        src: canvas.toDataURL('image/png'),
        correctPosition: { x: bounds.minX, y: bounds.minY },
        polygon: triangle,
        width: bounds.width,
        height: bounds.height,
        neighbors: {}
    };
}

function setupNeighbors(pieces: Piece[], tolerance: number = 1.0) {
    pieces.forEach((piece, i) => {
        pieces.forEach((otherPiece, j) => {
            if (i >= j) return;

            // Check if they share an edge (have 2 points very close together)
            const sharedPoints: Point[] = [];

            piece.polygon.forEach(p1 => {
                otherPiece.polygon.forEach(p2 => {
                    if (Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance) {
                        // Check if this point isn't already in sharedPoints
                        const isDuplicate = sharedPoints.some(sp =>
                            Math.abs(sp.x - p1.x) < 0.01 && Math.abs(sp.y - p1.y) < 0.01
                        );
                        if (!isDuplicate) {
                            sharedPoints.push({ x: p1.x, y: p1.y });
                        }
                    }
                });
            });

            if (sharedPoints.length >= 2) {
                // Sort points to create consistent edge key
                sharedPoints.sort((a, b) => {
                    if (Math.abs(a.x - b.x) > 0.1) return a.x - b.x;
                    return a.y - b.y;
                });

                const edgeKey = `${Math.round(sharedPoints[0].x * 10)},${Math.round(sharedPoints[0].y * 10)}-${Math.round(sharedPoints[1].x * 10)},${Math.round(sharedPoints[1].y * 10)}`;

                piece.neighbors[edgeKey] = otherPiece.id;
                otherPiece.neighbors[edgeKey] = piece.id;
            }
        });
    });
}

// Map piecesCount to grid dimensions
// Each cell produces exactly 4 triangles, so piecesCount = rows * cols * 4
function getGridForPieceCount(piecesCount: number): { rows: number; cols: number } {
    const gridMap: { pieces: number; rows: number; cols: number }[] = [
        { pieces: 4, rows: 1, cols: 1 },
        { pieces: 8, rows: 1, cols: 2 },
        { pieces: 12, rows: 1, cols: 3 },
        { pieces: 16, rows: 2, cols: 2 },
        { pieces: 20, rows: 1, cols: 5 },
        { pieces: 24, rows: 2, cols: 3 },
        { pieces: 32, rows: 2, cols: 4 },
        { pieces: 36, rows: 3, cols: 3 },
        { pieces: 40, rows: 2, cols: 5 },
        { pieces: 48, rows: 3, cols: 4 },
        { pieces: 60, rows: 3, cols: 5 },
        { pieces: 64, rows: 4, cols: 4 },
        { pieces: 72, rows: 3, cols: 6 },
        { pieces: 80, rows: 4, cols: 5 },
        { pieces: 96, rows: 4, cols: 6 },
        { pieces: 100, rows: 5, cols: 5 },
        { pieces: 120, rows: 5, cols: 6 },
        { pieces: 144, rows: 6, cols: 6 },
    ];

    const exact = gridMap.find(g => g.pieces === piecesCount);
    if (exact) return { rows: exact.rows, cols: exact.cols };

    // Fallback: find closest match
    let closest = gridMap[0];
    let minDiff = Math.abs(piecesCount - closest.pieces);
    for (const g of gridMap) {
        const diff = Math.abs(piecesCount - g.pieces);
        if (diff < minDiff) {
            minDiff = diff;
            closest = g;
        }
    }
    return { rows: closest.rows, cols: closest.cols };
}

// Valid piecesCount values: 4, 8, 12, 16, 20, 24, 32, 36, 40, 48, 60, 64, 72, 80, 96, 100, 120, 144

export default function PuzzleRandomPage({
    imageSrc = '/assets1000.jpg',
    piecesCount = 16,
    snapThreshold = 20,
    timeLimit = 30000,
}) {
    const { rows, cols } = getGridForPieceCount(piecesCount);
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [placedPieces, setPlacedPieces] = useState<Map<string, PlacedPiece>>(new Map());
    const [poolItems, setPoolItems] = useState<string[]>([]);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [dragPreviewPos, setDragPreviewPos] = useState<Point | null>(null);
    const [isSolved, setIsSolved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [timeRemaining, setTimeRemaining] = useState(timeLimit);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMusicOn, setIsMusicOn] = useState(true);
    const [isSfxOn, setIsSfxOn] = useState(true);

    const canvasRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const dragSourceRef = useRef<'pool' | 'placed' | null>(null);

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

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

    // Initialize puzzle
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const { pieces: trianglePieces, imageWidth, imageHeight } = await createTrianglePuzzle(imageSrc, rows, cols, 800);
                setPieces(trianglePieces);
                setImageDimensions({ width: imageWidth, height: imageHeight });
                const shuffled = [...trianglePieces.map(p => p.id)];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                setPoolItems(shuffled);
                setPlacedPieces(new Map());
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load puzzle');
            } finally {
                setLoading(false);
            }
        })();
    }, [imageSrc, rows, cols]);

    // Check if puzzle is solved
    useEffect(() => {
        if (pieces.length === 0 || poolItems.length > 0) return;
        const lockedCount = Array.from(placedPieces.values()).filter(p => p.isLocked).length;
        if (lockedCount === pieces.length) {
            setIsSolved(true);
        }
    }, [placedPieces, poolItems, pieces]);

    // Get all pieces in a connected group
    const getConnectedGroup = useCallback((pieceId: string): string[] => {
        const visited = new Set<string>();
        const queue = [pieceId];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            const placed = placedPieces.get(current);
            if (placed?.connectedGroup) {
                placed.connectedGroup.forEach(id => { if (!visited.has(id)) queue.push(id); });
            }
        }
        return Array.from(visited);
    }, [placedPieces]);

    // Check if piece should snap to neighbors
    const checkAndSnapToNeighbors = useCallback((pieceId: string, position: Point) => {
        const piece = pieces.find(p => p.id === pieceId);
        if (!piece) return { shouldSnap: false, snapPosition: position, neighbors: [] };
        const snapCandidates: { neighborId: string; snapPos: Point; dist: number }[] = [];
        Object.values(piece.neighbors).forEach(neighborId => {
            if (!neighborId) return;
            const neighborPlaced = placedPieces.get(neighborId);
            if (!neighborPlaced) return;
            const neighbor = pieces.find(p => p.id === neighborId);
            if (!neighbor) return;
            const offsetX = piece.correctPosition.x - neighbor.correctPosition.x;
            const offsetY = piece.correctPosition.y - neighbor.correctPosition.y;
            const expectedPos = { x: neighborPlaced.position.x + offsetX, y: neighborPlaced.position.y + offsetY };
            const dist = distance(position, expectedPos);
            if (dist < snapThreshold) {
                snapCandidates.push({ neighborId, snapPos: expectedPos, dist });
            }
        });
        if (snapCandidates.length > 0) {
            snapCandidates.sort((a, b) => a.dist - b.dist);
            const best = snapCandidates[0];
            const allNeighbors = new Set<string>();
            snapCandidates.forEach(candidate => {
                allNeighbors.add(candidate.neighborId);
                const connectedGroup = getConnectedGroup(candidate.neighborId);
                connectedGroup.forEach(id => allNeighbors.add(id));
            });
            return { shouldSnap: true, snapPosition: best.snapPos, neighbors: Array.from(allNeighbors) };
        }
        return { shouldSnap: false, snapPosition: position, neighbors: [] };
    }, [pieces, placedPieces, snapThreshold, getConnectedGroup]);

    const handlePoolPieceMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, pieceId: string) => {
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragSourceRef.current = 'pool';
        const piece = pieces.find(p => p.id === pieceId);
        const maxSize = 600;
        const sc = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));
        const offsetX = piece ? (piece.width * sc) / 2 : 0;
        const offsetY = piece ? (piece.height * sc) / 2 : 0;
        setDragState({ pieceIds: [pieceId], offset: { x: offsetX, y: offsetY } });
        setDragPreviewPos({ x: clientX, y: clientY });
        setPoolItems(prev => prev.filter(id => id !== pieceId));
    }, [pieces, imageDimensions]);

    const handlePlacedPieceMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, pieceId: string) => {
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const placed = placedPieces.get(pieceId);
        if (!placed) return;
        const maxSize = 600;
        const sc = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));
        const mouseX = (clientX - rect.left) / sc;
        const mouseY = (clientY - rect.top) / sc;
        const connectedGroup = getConnectedGroup(pieceId);
        dragSourceRef.current = 'placed';
        setDragState({ pieceIds: connectedGroup, offset: { x: mouseX - placed.position.x, y: mouseY - placed.position.y } });
        setDragPreviewPos(null);
    }, [placedPieces, getConnectedGroup, imageDimensions]);

    // Document-level mouse/touch handlers for responsive dragging
    useEffect(() => {
        if (!dragState) return;

        const maxSize = 600;
        const sc = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));

        const onMove = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            if (dragSourceRef.current === 'pool') {
                setDragPreviewPos({ x: clientX, y: clientY });
            } else {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const mouseX = (clientX - rect.left) / sc;
                    const mouseY = (clientY - rect.top) / sc;
                    const primaryPieceId = dragState.pieceIds[0];
                    const newX = mouseX - dragState.offset.x;
                    const newY = mouseY - dragState.offset.y;
                    const oldPlaced = placedPieces.get(primaryPieceId);
                    const offsetX = oldPlaced ? newX - oldPlaced.position.x : 0;
                    const offsetY = oldPlaced ? newY - oldPlaced.position.y : 0;
                    setPlacedPieces(prev => {
                        const newMap = new Map(prev);
                        dragState.pieceIds.forEach(id => {
                            const old = prev.get(id);
                            if (id === primaryPieceId) {
                                newMap.set(id, { id, position: { x: newX, y: newY }, isLocked: false, connectedGroup: new Set() });
                            } else if (old) {
                                newMap.set(id, { ...old, position: { x: old.position.x + offsetX, y: old.position.y + offsetY }, isLocked: false });
                            }
                        });
                        return newMap;
                    });
                });
            }
        };

        const onUp = (e: MouseEvent | TouchEvent) => {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
            const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
            const primaryPieceId = dragState.pieceIds[0];

            if (dragSourceRef.current === 'pool') {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
                    const dropX = (clientX - rect.left) / sc - dragState.offset.x;
                    const dropY = (clientY - rect.top) / sc - dragState.offset.y;
                    const position = { x: dropX, y: dropY };
                    const { shouldSnap, snapPosition, neighbors } = checkAndSnapToNeighbors(primaryPieceId, position);
                    const finalPos = shouldSnap ? snapPosition : position;

                    setPlacedPieces(prev => {
                        const newMap = new Map(prev);
                        if (shouldSnap && neighbors.length > 0) {
                            const allConnected = new Set([primaryPieceId, ...neighbors]);
                            allConnected.forEach(id => {
                                const old = prev.get(id);
                                if (id === primaryPieceId) {
                                    newMap.set(id, { id, position: finalPos, isLocked: true, connectedGroup: new Set([...allConnected].filter(cId => cId !== id)) });
                                } else if (old) {
                                    newMap.set(id, { ...old, isLocked: true, connectedGroup: new Set([...allConnected].filter(cId => cId !== id)) });
                                }
                            });
                        } else {
                            newMap.set(primaryPieceId, { id: primaryPieceId, position: finalPos, isLocked: false, connectedGroup: new Set() });
                        }
                        return newMap;
                    });
                } else {
                    setPoolItems(prev => [...prev, ...dragState.pieceIds]);
                }
            } else {
                const placed = placedPieces.get(primaryPieceId);
                if (placed) {
                    const { shouldSnap, snapPosition, neighbors } = checkAndSnapToNeighbors(primaryPieceId, placed.position);
                    if (shouldSnap && neighbors.length > 0) {
                        const offsetX = snapPosition.x - placed.position.x;
                        const offsetY = snapPosition.y - placed.position.y;
                        setPlacedPieces(prev => {
                            const newMap = new Map(prev);
                            const allConnected = new Set([...dragState.pieceIds, ...neighbors]);
                            dragState.pieceIds.forEach(id => {
                                const old = prev.get(id);
                                if (!old) return;
                                newMap.set(id, { id, position: { x: old.position.x + offsetX, y: old.position.y + offsetY }, isLocked: true, connectedGroup: new Set([...allConnected].filter(cId => cId !== id)) });
                            });
                            neighbors.forEach(neighborId => {
                                const neighbor = prev.get(neighborId);
                                if (!neighbor) return;
                                newMap.set(neighborId, { ...neighbor, connectedGroup: new Set([...allConnected].filter(cId => cId !== neighborId)) });
                            });
                            return newMap;
                        });
                    }
                }
            }

            setDragState(null);
            setDragPreviewPos(null);
            dragSourceRef.current = null;
        };

        document.addEventListener('mousemove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);

        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };
    }, [dragState, placedPieces, imageDimensions, checkAndSnapToNeighbors]);

    const handleReturnToPool = useCallback((pieceId: string) => {
        const connectedGroup = getConnectedGroup(pieceId);
        setPlacedPieces(prev => { const newMap = new Map(prev); connectedGroup.forEach(id => newMap.delete(id)); return newMap; });
        setPoolItems(prev => [...prev, ...connectedGroup]);
    }, [getConnectedGroup]);

    useEffect(() => { return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }; }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                <div className="text-center">
                    <div className="text-2xl font-bold text-amber-900 mb-3">Creating puzzle...</div>
                    <div className="text-amber-700">Generating varied triangle pieces</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
                <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
                    <div className="text-4xl mb-4">⚠️</div>
                    <div className="text-2xl font-bold text-red-900 mb-3">Error Loading Puzzle</div>
                    <div className="text-red-700 mb-4">{error}</div>
                    <div className="text-sm text-gray-600 mb-4">
                        Please check that the image path is correct and the image is accessible.
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const maxSize = 600;
    const scale = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));
    const displayWidth = imageDimensions.width * scale;
    const displayHeight = imageDimensions.height * scale;
    const remainingPieces = poolItems.length;

    return (
        <div className="w-screen h-screen overflow-hidden font-display text-slate-600 bg-gray-800">
            <style>{`
        body { margin: 0; overflow: hidden; cursor: default; }
        .game-container {
          width: 100vw; height: 100vh; position: relative; overflow: hidden;
          background: linear-gradient(180deg, #e0f2fe 0%, #dcfce7 100%);
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-left: 1px solid rgba(255, 255, 255, 0.4);
        }
        .puzzle-tray-thick {
          background-color: #ffffff; border-radius: 60px;
          box-shadow: 0 40px 80px -20px rgba(0,0,0,0.3), 0 10px 20px -5px rgba(0,0,0,0.1),
            inset 0 -10px 0 0 #e2e8f0, inset 0 4px 12px 0 rgba(255,255,255,1);
          border: 1px solid #f1f5f9; padding: 24px;
        }
        .puzzle-well {
          background-color: #f1f5f9; border-radius: 40px;
          box-shadow: inset 0 6px 15px rgba(0,0,0,0.12), inset 0 2px 6px rgba(0,0,0,0.08);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; background: rgba(0,0,0,0.05); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(74, 222, 128, 0.4); border-radius: 4px; }
        .sidebar-shape { border-top-left-radius: 60px; border-bottom-left-radius: 60px; }
        .cloud-shape {
          background: white; border-radius: 100px;
          box-shadow: 0 10px 25px -5px rgba(59,130,246,0.15), inset 0 -5px 10px rgba(0,0,0,0.02);
          position: absolute;
        }
        @keyframes float-cloud { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .float-anim { animation: float-cloud 6s ease-in-out infinite; }
        .float-anim-delayed { animation: float-cloud 7s ease-in-out 1s infinite; }

        .btn-3d { transition: all 0.1s ease; position: relative; top: 0; }
        .btn-3d:active { transform: translateY(4px); border-bottom-width: 0px !important; margin-bottom: 4px; }
      `}</style>

            <div className="game-container">
                {/* Decorative elements */}
                <div className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#60a5fa 2px, transparent 2px)', backgroundSize: '32px 32px' }}>
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
                <div className="absolute top-10 right-[380px] pointer-events-none z-0">
                    <div className="w-24 h-24 bg-yellow-200 rounded-full shadow-[0_0_40px_rgba(253,224,71,0.6)] animate-pulse"></div>
                </div>

                <div className="relative z-10 flex h-full w-full">
                    {/* Main puzzle area */}
                    <main className="flex-1 flex flex-col relative h-full items-center justify-center p-8 order-1">
                        {/* Top navigation */}
                        <div className="absolute top-8 z-20 w-full flex justify-center pointer-events-none">
                            <div className="relative flex items-center gap-12 pointer-events-auto bg-white/40 backdrop-blur-sm py-4 px-10 rounded-full border border-white/60 shadow-sm">
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
                        <div className="relative z-10 transform transition-transform origin-center mt-12">
                            <div className="puzzle-tray-thick relative inline-block">
                                {/* Decorative buttons */}
                                <div className="absolute -top-6 -left-6 w-20 h-20 bg-pink-400 rounded-full border-[6px] border-white shadow-lg z-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                                    <span className="material-icons-round text-white text-3xl drop-shadow-md">favorite</span>
                                </div>
                                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-green-400 rounded-full border-[6px] border-white shadow-lg z-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                                    <span className="material-icons-round text-white text-3xl drop-shadow-md">star</span>
                                </div>

                                <div
                                    className="puzzle-well flex items-center justify-center overflow-hidden relative"
                                    style={{ width: `${displayWidth + 80}px`, height: `${displayHeight + 80}px`, padding: '30px' }}
                                >
                                    <div
                                        ref={canvasRef}
                                        className="relative rounded-lg overflow-visible"
                                        style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
                                    >
                                        {/* Background guide image */}
                                        <img
                                            src={imageSrc}
                                            alt="Guide"
                                            className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-lg"
                                            style={{ opacity: 0.3, zIndex: 0 }}
                                        />

                                        {/* Placed pieces */}
                                        {Array.from(placedPieces.entries()).map(([pieceId, placed]) => {
                                            const piece = pieces.find(p => p.id === pieceId);
                                            if (!piece) return null;
                                            const isDragging = dragState?.pieceIds.includes(pieceId);
                                            return (
                                                <div
                                                    key={pieceId}
                                                    className="absolute select-none cursor-move"
                                                    style={{
                                                        left: `${placed.position.x * scale}px`,
                                                        top: `${placed.position.y * scale}px`,
                                                        width: `${piece.width * scale}px`,
                                                        height: `${piece.height * scale}px`,
                                                        zIndex: isDragging ? 1000 : placed.isLocked ? 100 : 50,
                                                        opacity: isDragging ? 0.8 : 1,
                                                        filter: placed.isLocked
                                                            ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))'
                                                            : 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))',
                                                        transition: placed.isLocked ? 'filter 0.2s ease' : 'none',
                                                        willChange: isDragging ? 'transform' : 'auto',
                                                    }}
                                                    onMouseDown={(e) => handlePlacedPieceMouseDown(e, pieceId)}
                                                    onTouchStart={(e) => handlePlacedPieceMouseDown(e, pieceId)}
                                                    onDoubleClick={() => handleReturnToPool(pieceId)}
                                                >
                                                    <img src={piece.src} alt="" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} style={{ imageRendering: 'auto' }} />
                                                </div>
                                            );
                                        })}
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
                    <aside className="flex-shrink-0 w-[360px] h-full relative z-20 order-2 flex">
                        <div className="w-full h-full sidebar-shape shadow-2xl overflow-hidden glass-panel flex flex-col relative">
                            {/* Header */}
                            <div className="pt-10 pb-6 px-8 flex flex-col gap-6 z-10">
                                <div className="flex items-center justify-between w-full">
                                    <button
                                        onClick={() => setIsPaused(true)}
                                        className="bg-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all text-blue-500 border border-blue-100 group"
                                    >
                                        <span className="material-icons-round text-3xl">menu</span>
                                    </button>
                                    <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-sm border border-blue-100">
                                        <span className="material-icons-round text-green-400 text-4xl">timer</span>
                                        <span className={`text-4xl font-bold tracking-tight tabular-nums font-display ${timeRemaining < 30 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {formatTime(timeRemaining)}
                                        </span>
                                    </div>
                                </div>

                                {/* Pieces remaining */}
                                <div className="flex flex-col items-center justify-center w-full mt-2">
                                    <div className="bg-linear-to-br from-white to-blue-50 w-full rounded-3xl p-5 shadow-sm border border-white/50 flex items-center justify-between px-6">
                                        <div className="flex flex-col items-start">
                                            <span className="text-5xl font-black text-slate-700 tracking-tight font-display leading-none">
                                                {remainingPieces} / {pieces.length}
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
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-8 relative z-10 w-full">
                                <div className="flex flex-col gap-10 items-center pt-4">
                                    {poolItems.map((id) => {
                                        const piece = pieces.find(p => p.id === id);
                                        return piece ? (
                                            <div
                                                key={id}
                                                className="group relative w-36 aspect-square flex items-center justify-center cursor-grab shrink-0 hover:scale-110 transition-all duration-300"
                                                style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
                                                onMouseDown={(e) => handlePoolPieceMouseDown(e, id)}
                                                onTouchStart={(e) => handlePoolPieceMouseDown(e, id)}
                                            >
                                                <img src={piece.src} alt="Puzzle piece" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </div>

                            {/* Bottom gradient */}
                            <div className="h-20 bg-linear-to-t from-white/60 to-transparent pointer-events-none absolute bottom-0 w-full z-20 sidebar-shape rounded-t-none"></div>
                        </div>

                        {/* Floating drag preview */}
                        {dragState && dragPreviewPos && dragSourceRef.current === 'pool' && (() => {
                            const piece = pieces.find(p => p.id === dragState.pieceIds[0]);
                            if (!piece) return null;
                            return (
                                <div
                                    className="fixed pointer-events-none z-9999"
                                    style={{
                                        left: `${dragPreviewPos.x - dragState.offset.x}px`,
                                        top: `${dragPreviewPos.y - dragState.offset.y}px`,
                                        width: `${piece.width * scale}px`,
                                        height: `${piece.height * scale}px`,
                                        opacity: 0.85,
                                        filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))',
                                        transform: 'scale(1.05)',
                                    }}
                                >
                                    <img src={piece.src} alt="" className="w-full h-full object-contain" draggable={false} />
                                </div>
                            );
                        })()}
                    </aside>
                </div>

                {/* Pause Menu Overlay */}
                {isPaused && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="w-full max-w-[400px] min-h-[500px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col items-center p-8 relative overflow-hidden border-4 border-white/20">
                            <div className="absolute top-0 left-0 w-full h-24 bg-linear-to-b from-amber-500/10 to-transparent"></div>
                            <div className="relative z-10 flex flex-col items-center mb-8 w-full">
                                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 animate-[spin_10s_linear_infinite]">
                                    <span className="material-icons-round text-amber-500 text-4xl">settings</span>
                                </div>
                                <h1 className="text-4xl font-bold text-neutral-800 tracking-wide">Menu</h1>
                            </div>
                            <div className="flex flex-col w-full gap-5 z-10">
                                <button onClick={() => setIsPaused(false)} className="btn-3d w-full group relative flex items-center justify-between px-6 py-4 bg-green-400 hover:bg-green-500 border-b-[6px] border-green-500 rounded-full text-white transition-colors">
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">play_arrow</span>
                                    </div>
                                    <span className="grow text-center text-xl font-bold mr-8">Lanjutkan</span>
                                </button>
                                <button onClick={() => setIsMusicOn(!isMusicOn)} className="btn-3d w-full group relative flex items-center justify-between px-6 py-4 bg-sky-400 hover:bg-sky-500 border-b-[6px] border-sky-500 rounded-full text-white transition-colors">
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">music_note</span>
                                    </div>
                                    <span className="grow text-center text-xl font-bold">Musik</span>
                                    <div className="bg-white/20 px-3 py-1 rounded-lg text-sm font-bold ml-2">{isMusicOn ? 'ON' : 'OFF'}</div>
                                </button>
                                <button onClick={() => setIsSfxOn(!isSfxOn)} className="btn-3d w-full group relative flex items-center justify-between px-6 py-4 bg-amber-500 hover:bg-amber-600 border-b-[6px] border-amber-600 rounded-full text-white transition-colors">
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">{isSfxOn ? 'volume_up' : 'volume_off'}</span>
                                    </div>
                                    <span className="grow text-center text-xl font-bold">Suara</span>
                                    <div className="bg-white/20 px-3 py-1 rounded-lg text-sm font-bold ml-2">{isSfxOn ? 'ON' : 'OFF'}</div>
                                </button>
                                <button onClick={() => window.location.href = '/'} className="btn-3d w-full mt-2 group relative flex items-center justify-between px-6 py-4 bg-red-400 hover:bg-red-500 border-b-[6px] border-red-500 rounded-full text-white transition-colors">
                                    <div className="bg-white/20 rounded-full p-2 mr-4 group-hover:bg-white/30 transition-colors">
                                        <span className="material-icons-round text-3xl">home</span>
                                    </div>
                                    <span className="grow text-center text-xl font-bold mr-8">Keluar</span>
                                </button>
                            </div>
                            <div className="mt-auto pt-6 text-neutral-400 text-sm font-medium">Puzzle Random</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}