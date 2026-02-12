'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';

// Types
type Point = { x: number; y: number };

type Triangle = {
  points: [Point, Point, Point]; // Three vertices
  center: Point;
};

type Piece = {
  id: string;
  row: number;
  col: number;
  triangleIndex: number; // 0 or 1 (upper or lower triangle in cell)
  src: string;
  correctPosition: Point;
  polygon: Point[]; // Actual shape points
  width: number;
  height: number;
  neighbors: {
    [key: string]: string | null; // edge direction -> neighbor piece id
  };
};

type PlacedPiece = {
  id: string;
  position: Point;
  isLocked: boolean;
  connectedGroup: Set<string>;
};

// Removed DragState type — now using dnd-kit

// Calculate distance between two points
function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Get polygon bounds
function getPolygonBounds(polygon: Point[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Create triangle mesh and cut image into triangle pieces
async function createTrianglePuzzle(
  imageSrc: string,
  rows: number,
  cols: number
): Promise<{ pieces: Piece[]; imageWidth: number; imageHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      const pieces: Piece[] = [];
      const width = img.width;
      const height = img.height;

      const cellWidth = width / cols;
      const cellHeight = height / rows;

      // Create triangulated grid
      // Each cell is divided into 2 triangles (upper-left and lower-right)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Cell corners
          const topLeft = { x: col * cellWidth, y: row * cellHeight };
          const topRight = { x: (col + 1) * cellWidth, y: row * cellHeight };
          const bottomLeft = { x: col * cellWidth, y: (row + 1) * cellHeight };
          const bottomRight = { x: (col + 1) * cellWidth, y: (row + 1) * cellHeight };

          // Decide diagonal direction (alternate for variety)
          const diagonalType = (row + col) % 2;

          if (diagonalType === 0) {
            // Diagonal from top-left to bottom-right
            // Triangle 1: top-left, top-right, bottom-right
            const tri1 = [topLeft, topRight, bottomRight];
            // Triangle 2: top-left, bottom-right, bottom-left
            const tri2 = [topLeft, bottomRight, bottomLeft];

            pieces.push(createTrianglePiece(img, tri1, row, col, 0, rows, cols));
            pieces.push(createTrianglePiece(img, tri2, row, col, 1, rows, cols));
          } else {
            // Diagonal from top-right to bottom-left
            // Triangle 1: top-left, top-right, bottom-left
            const tri1 = [topLeft, topRight, bottomLeft];
            // Triangle 2: top-right, bottom-right, bottom-left
            const tri2 = [topRight, bottomRight, bottomLeft];

            pieces.push(createTrianglePiece(img, tri1, row, col, 0, rows, cols));
            pieces.push(createTrianglePiece(img, tri2, row, col, 1, rows, cols));
          }
        }
      }

      // Set up neighbor relationships
      setupNeighbors(pieces, rows, cols);

      resolve({ pieces, imageWidth: width, imageHeight: height });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

function createTrianglePiece(
  img: HTMLImageElement,
  triangle: Point[],
  row: number,
  col: number,
  triangleIndex: number,
  rows: number,
  cols: number
): Piece {
  // Get bounds of triangle
  const bounds = getPolygonBounds(triangle);

  // Add small padding to prevent edge clipping
  const padding = 1;
  const canvasWidth = bounds.width + padding * 2;
  const canvasHeight = bounds.height + padding * 2;

  // Create canvas for this piece
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Translate triangle to canvas coordinates
  const offsetTriangle = triangle.map(p => ({
    x: p.x - bounds.minX + padding,
    y: p.y - bounds.minY + padding
  }));

  // Clip to triangle shape
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(offsetTriangle[0].x, offsetTriangle[0].y);
  ctx.lineTo(offsetTriangle[1].x, offsetTriangle[1].y);
  ctx.lineTo(offsetTriangle[2].x, offsetTriangle[2].y);
  ctx.closePath();
  ctx.clip();

  // Draw the image section
  ctx.drawImage(
    img,
    bounds.minX - padding,
    bounds.minY - padding,
    canvasWidth,
    canvasHeight,
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  ctx.restore();

  // Draw subtle border for visibility (optional - remove for seamless look)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(offsetTriangle[0].x, offsetTriangle[0].y);
  ctx.lineTo(offsetTriangle[1].x, offsetTriangle[1].y);
  ctx.lineTo(offsetTriangle[2].x, offsetTriangle[2].y);
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

function setupNeighbors(pieces: Piece[], rows: number, cols: number) {
  // Build a lookup map
  const pieceMap = new Map<string, Piece>();
  pieces.forEach(piece => {
    pieceMap.set(piece.id, piece);
  });

  // For each piece, find its neighbors by checking shared edges
  pieces.forEach(piece => {
    pieces.forEach(otherPiece => {
      if (piece.id === otherPiece.id) return;

      // Check if they share an edge (have 2 identical points)
      const sharedPoints = piece.polygon.filter(p1 =>
        otherPiece.polygon.some(p2 =>
          Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1
        )
      );

      if (sharedPoints.length === 2) {
        // They are neighbors!
        const edgeKey = `${sharedPoints[0].x},${sharedPoints[0].y}-${sharedPoints[1].x},${sharedPoints[1].y}`;
        piece.neighbors[edgeKey] = otherPiece.id;
      }
    });
  });
}

/**
 * Possible pieceCount values (each cell = 2 triangles):
 *   8  (2×2)  - Very Easy
 *  12  (2×3)  - Easy
 *  18  (3×3)  - Easy-Medium
 *  24  (3×4)  - Medium
 *  32  (4×4)  - Medium-Hard
 *  40  (4×5)  - Hard
 *  50  (5×5)  - Very Hard
 *  72  (6×6)  - Expert
 */
function getPieceDimensions(pieceCount: number): { rows: number; cols: number } {
  const mapping: Record<number, { rows: number; cols: number }> = {
    8: { rows: 2, cols: 2 },
    12: { rows: 2, cols: 3 },
    18: { rows: 3, cols: 3 },
    24: { rows: 3, cols: 4 },
    32: { rows: 4, cols: 4 },
    40: { rows: 4, cols: 5 },
    50: { rows: 5, cols: 5 },
    72: { rows: 6, cols: 6 },
  };
  return mapping[pieceCount] || { rows: 4, cols: 4 };
}

// Sub-component: Draggable pool piece
function PoolPieceItem({ pieceId, piece }: { pieceId: string; piece: Piece }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: pieceId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="group relative w-36 aspect-square flex items-center justify-center cursor-grab shrink-0 hover:scale-110 transition-all duration-300"
      style={{
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <img src={piece.src} alt="Puzzle piece" className="w-full h-full object-contain pointer-events-none" draggable={false} />
    </div>
  );
}

// Sub-component: Draggable placed piece
function PlacedPieceItem({
  pieceId, piece, placed, scale, isBeingDragged, dragDelta, onDoubleClick
}: {
  pieceId: string; piece: Piece; placed: PlacedPiece; scale: number;
  isBeingDragged: boolean; dragDelta: Point | null; onDoubleClick: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: pieceId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="absolute select-none cursor-move"
      style={{
        left: `${placed.position.x * scale}px`,
        top: `${placed.position.y * scale}px`,
        width: `${piece.width * scale}px`,
        height: `${piece.height * scale}px`,
        zIndex: isBeingDragged ? 1000 : placed.isLocked ? 100 : 50,
        opacity: isBeingDragged ? 0.85 : 1,
        filter: isBeingDragged
          ? 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))'
          : placed.isLocked
            ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))'
            : 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))',
        transition: isBeingDragged ? 'none' : placed.isLocked ? 'filter 0.2s ease' : 'none',
        transform: isBeingDragged && dragDelta
          ? `translate(${dragDelta.x}px, ${dragDelta.y}px)`
          : 'none',
      }}
      onDoubleClick={onDoubleClick}
    >
      <img src={piece.src} alt="" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
    </div>
  );
}

// Sub-component: Canvas drop zone
function CanvasDropZone({ children, canvasRef, displayWidth, displayHeight }: {
  children: React.ReactNode;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  displayWidth: number;
  displayHeight: number;
}) {
  const { setNodeRef } = useDroppable({ id: 'puzzle-canvas' });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (canvasRef && 'current' in canvasRef) {
          (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      className="relative rounded-lg overflow-visible"
      style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
    >
      {children}
    </div>
  );
}

export default function PuzzleTriangle({
  imageSrc = '/assets2600.jpg',
  pieceCount = 12,
  snapThreshold = 10,
  timeLimit = 3000,
}: {
  imageSrc?: string;
  pieceCount?: 8 | 12 | 18 | 24 | 32 | 40 | 50 | 72;
  snapThreshold?: number;
  timeLimit?: number;
}) {
  const { rows, cols } = getPieceDimensions(pieceCount);

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [placedPieces, setPlacedPieces] = useState<Map<string, PlacedPiece>>(new Map());
  const [poolItems, setPoolItems] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<'pool' | 'placed' | null>(null);
  const [dragDelta, setDragDelta] = useState<Point | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(true);
  const [isSfxOn, setIsSfxOn] = useState(true);
  const [windowSize, setWindowSize] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 1920, h: typeof window !== 'undefined' ? window.innerHeight : 1080 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio refs
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const sfxCorrectRef = useRef<HTMLAudioElement | null>(null);
  const sfxFailRef = useRef<HTMLAudioElement | null>(null);
  const sfxCompleteRef = useRef<HTMLAudioElement | null>(null);

  // Track window size for responsive puzzle sizing
  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize audio elements
  useEffect(() => {
    bgMusicRef.current = new Audio('/sfx/bg-music.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.4;

    sfxCorrectRef.current = new Audio('/sfx/correct.mp3');
    sfxFailRef.current = new Audio('/sfx/fail.mp3');
    sfxCompleteRef.current = new Audio('/sfx/complete-puzzle.mp3');

    return () => {
      bgMusicRef.current?.pause();
      bgMusicRef.current = null;
    };
  }, []);

  // Play/pause background music
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
        if (prev <= 1) { setIsGameOver(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, isSolved, isGameOver, isPaused]);

  // Initialize puzzle
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { pieces: trianglePieces, imageWidth, imageHeight } = await createTrianglePuzzle(imageSrc, rows, cols);
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [imageSrc, rows, cols]);

  // Check if puzzle is solved
  useEffect(() => {
    if (pieces.length === 0) return;
    // All pieces must be placed on the board (out of pool) and connected
    if (placedPieces.size === pieces.length && poolItems.length === 0) {
      // Check if all pieces belong to one connected group
      const firstId = pieces[0].id;
      const group = new Set<string>();
      const queue = [firstId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (group.has(current)) continue;
        group.add(current);
        const placed = placedPieces.get(current);
        if (placed?.connectedGroup) {
          placed.connectedGroup.forEach(id => { if (!group.has(id)) queue.push(id); });
        }
      }
      if (group.size === pieces.length) {
        setIsSolved(true);
        bgMusicRef.current?.pause();
        playSfx(sfxCompleteRef);
      }
    }
  }, [placedPieces, poolItems, pieces, isSfxOn]);

  // Play fail SFX when game over (time ran out)
  useEffect(() => {
    if (isGameOver && !isSolved) {
      bgMusicRef.current?.pause();
      playSfx(sfxFailRef);
    }
  }, [isGameOver, isSolved, isSfxOn]);

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

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);

    if (poolItems.includes(id)) {
      setDragSource('pool');
      // Remove from pool immediately
      setPoolItems(prev => prev.filter(pid => pid !== id));
    } else if (placedPieces.has(id)) {
      setDragSource('placed');
    }
  }, [poolItems, placedPieces]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (dragSource === 'placed') {
      setDragDelta({ x: event.delta.x, y: event.delta.y });
    }
  }, [dragSource]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const pieceId = active.id as string;
    const piece = pieces.find(p => p.id === pieceId);

    if (!piece) {
      setActiveId(null);
      setDragSource(null);
      return;
    }

    const sidebarW = windowSize.w >= 1280 ? 360 : 280;
    const maxSize = Math.min(800, windowSize.w - sidebarW - 160, windowSize.h - 250);
    const sc = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));

    if (dragSource === 'pool') {
      if (over?.id === 'puzzle-canvas') {
        // Calculate drop position on canvas
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && event.activatorEvent) {
          const activatorEvent = event.activatorEvent as PointerEvent;
          const startX = activatorEvent.clientX;
          const startY = activatorEvent.clientY;
          const endX = startX + (event.delta?.x || 0);
          const endY = startY + (event.delta?.y || 0);

          const dropX = (endX - rect.left) / sc - (piece.width / 2);
          const dropY = (endY - rect.top) / sc - (piece.height / 2);
          const position = { x: dropX, y: dropY };

          const { shouldSnap, snapPosition, neighbors } = checkAndSnapToNeighbors(pieceId, position);
          const finalPos = shouldSnap ? snapPosition : position;

          if (shouldSnap && neighbors.length > 0) {
            playSfx(sfxCorrectRef);
          }

          setPlacedPieces(prev => {
            const newMap = new Map(prev);
            if (shouldSnap && neighbors.length > 0) {
              const allConnected = new Set([pieceId, ...neighbors]);
              allConnected.forEach(id => {
                const old = prev.get(id);
                if (id === pieceId) {
                  newMap.set(id, { id, position: finalPos, isLocked: true, connectedGroup: new Set([...allConnected].filter(cId => cId !== id)) });
                } else if (old) {
                  newMap.set(id, { ...old, isLocked: true, connectedGroup: new Set([...allConnected].filter(cId => cId !== id)) });
                }
              });
            } else {
              newMap.set(pieceId, { id: pieceId, position: finalPos, isLocked: false, connectedGroup: new Set() });
            }
            return newMap;
          });
        } else {
          // Dropped outside canvas — return to pool
          setPoolItems(prev => [...prev, pieceId]);
        }
      } else {
        // Not dropped on canvas — return to pool  
        setPoolItems(prev => [...prev, pieceId]);
      }
    } else if (dragSource === 'placed') {
      // Move placed piece(s) by delta
      const deltaX = (event.delta?.x || 0) / sc;
      const deltaY = (event.delta?.y || 0) / sc;
      const connectedGroup = getConnectedGroup(pieceId);

      setPlacedPieces(prev => {
        const newMap = new Map(prev);
        // Move all connected pieces by delta
        connectedGroup.forEach(id => {
          const old = prev.get(id);
          if (old) {
            newMap.set(id, {
              ...old,
              position: { x: old.position.x + deltaX, y: old.position.y + deltaY },
              isLocked: false,
            });
          }
        });

        // Check snap for ALL pieces in the dragged group against non-group neighbors
        let bestSnap: { snapPos: Point; groupPieceId: string; groupPiecePos: Point; neighborId: string; dist: number } | null = null;
        const allNeighborIds = new Set<string>();

        // Check each piece in the group for potential neighbor snaps
        connectedGroup.forEach(groupId => {
          const groupPiece = pieces.find(p => p.id === groupId);
          const groupPlaced = newMap.get(groupId);
          if (!groupPiece || !groupPlaced) return;

          Object.values(groupPiece.neighbors).forEach(neighborId => {
            if (!neighborId || connectedGroup.includes(neighborId)) return;
            const neighborPlaced = newMap.get(neighborId);
            if (!neighborPlaced) return;
            const neighborPiece = pieces.find(p => p.id === neighborId);
            if (!neighborPiece) return;

            // Expected position of groupPiece relative to the neighbor
            const expectedPos = {
              x: neighborPlaced.position.x + (groupPiece.correctPosition.x - neighborPiece.correctPosition.x),
              y: neighborPlaced.position.y + (groupPiece.correctPosition.y - neighborPiece.correctPosition.y),
            };

            const dist = distance(groupPlaced.position, expectedPos);

            if (dist < snapThreshold) {
              allNeighborIds.add(neighborId);
              if (!bestSnap || dist < bestSnap.dist) {
                bestSnap = { snapPos: expectedPos, groupPieceId: groupId, groupPiecePos: groupPlaced.position, neighborId, dist };
              }
            }
          });
        });

        if (bestSnap !== null && allNeighborIds.size > 0) {
          playSfx(sfxCorrectRef);
          const bs = bestSnap as { snapPos: Point; groupPieceId: string; groupPiecePos: Point; neighborId: string; dist: number };

          // Calculate how much to shift the entire dragged group so the best piece lands exactly on its snap position
          const snapOffset = {
            x: bs.snapPos.x - bs.groupPiecePos.x,
            y: bs.snapPos.y - bs.groupPiecePos.y,
          };

          // Expand allNeighborIds to include their full connected groups (transitive merge)
          const expandedNeighbors = new Set<string>();
          allNeighborIds.forEach(nId => {
            // Walk the connected group of each neighbor (using prev state, not newMap, to avoid partial updates)
            const queue = [nId];
            const visited = new Set<string>();
            while (queue.length > 0) {
              const current = queue.shift()!;
              if (visited.has(current) || connectedGroup.includes(current)) continue;
              visited.add(current);
              const placed = newMap.get(current);
              if (placed?.connectedGroup) {
                placed.connectedGroup.forEach(cId => { if (!visited.has(cId)) queue.push(cId); });
              }
            }
            visited.forEach(id => expandedNeighbors.add(id));
          });

          const allConnected = new Set([...connectedGroup, ...expandedNeighbors]);
          allConnected.forEach(id => {
            const old = newMap.get(id);
            if (!old) return;
            const isDragged = connectedGroup.includes(id);
            newMap.set(id, {
              id,
              position: isDragged
                ? { x: old.position.x + snapOffset.x, y: old.position.y + snapOffset.y }
                : old.position,
              isLocked: true,
              connectedGroup: new Set([...allConnected].filter(cId => cId !== id)),
            });
          });
        }

        return newMap;
      });
    }

    setActiveId(null);
    setDragSource(null);
    setDragDelta(null);
  }, [pieces, placedPieces, poolItems, imageDimensions, dragSource, checkAndSnapToNeighbors, getConnectedGroup, snapThreshold, isSfxOn]);

  const handleReturnToPool = useCallback((pieceId: string) => {
    const connectedGroup = getConnectedGroup(pieceId);
    setPlacedPieces(prev => { const newMap = new Map(prev); connectedGroup.forEach(id => newMap.delete(id)); return newMap; });
    setPoolItems(prev => [...prev, ...connectedGroup]);
  }, [getConnectedGroup]);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #dcfce7 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-4 animate-bounce">
            <span className="material-icons-round text-4xl">extension</span>
          </div>
          <div className="text-2xl font-bold text-slate-700 mb-2">Membuat puzzle...</div>
          <div className="text-slate-500">Memotong potongan segitiga</div>
        </div>
      </div>
    );
  }

  const sidebarW = windowSize.w >= 1280 ? 360 : 280;
  const maxSize = Math.min(800, windowSize.w - sidebarW - 160, windowSize.h - 250);
  const scale = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));
  const displayWidth = imageDimensions.width * scale;
  const displayHeight = imageDimensions.height * scale;
  const remainingPieces = poolItems.length;

  return (
    <div className="w-screen h-screen overflow-hidden font-display text-slate-600 bg-gray-800">
      <style>{`
        body { margin: 0; overflow: hidden; cursor: default; }
        .game-container {
          width: 100vw; height: 100vh; max-width: 1600px; margin: 0 auto; position: relative; overflow: hidden;
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
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .confetti-piece { animation: confetti-fall linear forwards; position: absolute; top: 0; }
        .pop-in { animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
        <div className="game-container">
          {/* Dot pattern */}
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
          <div className="absolute top-10 right-[350px] pointer-events-none z-0">
            <div className="w-16 h-16 xl:w-24 xl:h-24 bg-yellow-200 rounded-full shadow-[0_0_40px_rgba(253,224,71,0.6)] animate-pulse"></div>
          </div>

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
                  {/* Decorative corner buttons */}
                  <div className="absolute -top-4 -left-4 xl:-top-6 xl:-left-6 w-14 h-14 xl:w-20 xl:h-20 bg-pink-400 rounded-full border-4 xl:border-[6px] border-white shadow-lg z-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                    <span className="material-icons-round text-white text-xl xl:text-3xl drop-shadow-md">favorite</span>
                  </div>
                  <div className="absolute -bottom-4 -right-4 xl:-bottom-6 xl:-right-6 w-14 h-14 xl:w-20 xl:h-20 bg-green-400 rounded-full border-4 xl:border-[6px] border-white shadow-lg z-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                    <span className="material-icons-round text-white text-xl xl:text-3xl drop-shadow-md">star</span>
                  </div>

                  <div
                    className="puzzle-well flex items-center justify-center overflow-hidden relative"
                    style={{ width: `${displayWidth + 80}px`, height: `${displayHeight + 80}px`, padding: '30px' }}
                  >
                    <CanvasDropZone canvasRef={canvasRef} displayWidth={displayWidth} displayHeight={displayHeight}>
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
                        const isBeingDragged = dragSource === 'placed' && activeId !== null && getConnectedGroup(activeId).includes(pieceId);
                        return (
                          <PlacedPieceItem
                            key={pieceId}
                            pieceId={pieceId}
                            piece={piece}
                            placed={placed}
                            scale={scale}
                            isBeingDragged={isBeingDragged}
                            dragDelta={isBeingDragged ? dragDelta : null}
                            onDoubleClick={() => handleReturnToPool(pieceId)}
                          />
                        );
                      })}
                    </CanvasDropZone>
                  </div>
                </div>
              </div>

              {/* Game over overlay */}
              {(isSolved || isGameOver) && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                  {/* Confetti particles */}
                  {isSolved && (
                    <>
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="confetti-piece rounded-sm"
                          style={{
                            left: `${Math.random() * 100}%`,
                            width: `${8 + Math.random() * 12}px`,
                            height: `${8 + Math.random() * 12}px`,
                            backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
                            animationDuration: `${2 + Math.random() * 3}s`,
                            animationDelay: `${Math.random() * 1}s`,
                          }}
                        />
                      ))}
                    </>
                  )}

                  <div className="pop-in bg-white rounded-[2.5rem] p-10 shadow-2xl text-center max-w-md mx-4 relative overflow-hidden border-4 border-white/20">
                    {/* Decorative gradient top */}
                    <div className="absolute top-0 left-0 w-full h-20 bg-linear-to-b from-yellow-100/60 to-transparent pointer-events-none"></div>

                    {isSolved ? (
                      <>
                        {/* Star decorations */}
                        <div className="absolute top-4 left-6 text-yellow-400 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>⭐</div>
                        <div className="absolute top-8 right-8 text-yellow-400 text-lg animate-bounce" style={{ animationDelay: '0.5s' }}>✨</div>
                        <div className="absolute top-4 right-16 text-yellow-400 text-2xl animate-bounce" style={{ animationDelay: '0.8s' }}>🌟</div>

                        <div className="relative z-10">
                          <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-200">
                            <span className="material-icons-round text-white text-5xl">emoji_events</span>
                          </div>
                          <h2 className="text-4xl font-black text-slate-800 mb-2">Selamat! 🎉</h2>
                          <p className="text-lg text-slate-500 mb-2">Puzzle berhasil diselesaikan!</p>
                          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-5 py-2 rounded-full font-bold text-lg mb-6">
                            <span className="material-icons-round text-xl">timer</span>
                            {formatTime(timeLimit - timeRemaining)}
                          </div>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => window.location.reload()}
                              className="btn-3d bg-yellow-400 hover:bg-yellow-500 border-b-[5px] border-yellow-500 text-white px-8 py-3 rounded-full font-bold text-lg transition-colors flex items-center gap-2"
                            >
                              <span className="material-icons-round">replay</span> Main Lagi
                            </button>
                            <button
                              onClick={() => window.location.href = '/'}
                              className="btn-3d bg-slate-200 hover:bg-slate-300 border-b-[5px] border-slate-300 text-slate-600 px-6 py-3 rounded-full font-bold text-lg transition-colors flex items-center gap-2"
                            >
                              <span className="material-icons-round">home</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative z-10">
                          <div className="w-20 h-20 bg-red-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200">
                            <span className="material-icons-round text-white text-5xl">alarm</span>
                          </div>
                          <h2 className="text-4xl font-black text-slate-800 mb-2">Waktu Habis! ⏰</h2>
                          <p className="text-lg text-slate-500 mb-6">
                            Coba lagi untuk menyelesaikan puzzle!
                          </p>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => window.location.reload()}
                              className="btn-3d bg-blue-500 hover:bg-blue-600 border-b-[5px] border-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg transition-colors flex items-center gap-2"
                            >
                              <span className="material-icons-round">replay</span> Coba Lagi
                            </button>
                            <button
                              onClick={() => window.location.href = '/'}
                              className="btn-3d bg-slate-200 hover:bg-slate-300 border-b-[5px] border-slate-300 text-slate-600 px-6 py-3 rounded-full font-bold text-lg transition-colors flex items-center gap-2"
                            >
                              <span className="material-icons-round">home</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </main>

            {/* Sidebar */}
            <aside className="shrink-0 w-[280px] xl:w-[360px] h-full relative z-20 order-2 flex">
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
                      <span className={`text-3xl xl:text-4xl font-bold tracking-tight tabular-nums font-display ${timeRemaining < 30 ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatTime(timeRemaining)}
                      </span>
                    </div>
                  </div>

                  {/* Pieces remaining */}
                  <div className="flex flex-col items-center justify-center w-full mt-2">
                    <div className="bg-linear-to-br from-white to-blue-50 w-full rounded-3xl p-5 shadow-sm border border-white/50 flex items-center justify-between px-6">
                      <div className="flex flex-col items-start">
                        <span className="text-4xl xl:text-5xl font-black text-slate-700 tracking-tight font-display leading-none">
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
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 xl:px-6 pb-6 xl:pb-8 relative z-10 w-full">
                  <div className="flex flex-col gap-6 items-center pt-4">
                    {poolItems.map((id) => {
                      const piece = pieces.find(p => p.id === id);
                      return piece ? (
                        <PoolPieceItem key={id} pieceId={id} piece={piece} />
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Bottom gradient */}
                <div className="h-20 bg-linear-to-t from-white/60 to-transparent pointer-events-none absolute bottom-0 w-full z-20 sidebar-shape rounded-t-none"></div>
              </div>
            </aside>
          </div>

          {/* DragOverlay — only for pool piece drags */}
          <DragOverlay dropAnimation={null}>
            {activeId && dragSource === 'pool' && (() => {
              const piece = pieces.find(p => p.id === activeId);
              if (!piece) return null;
              return (
                <div
                  style={{
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
          </DragOverlay>
        </div>
      </DndContext>

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
            <div className="mt-auto pt-6 text-neutral-400 text-sm font-medium">Puzzle Triangle</div>
          </div>
        </div>
      )}
    </div>
  );
}