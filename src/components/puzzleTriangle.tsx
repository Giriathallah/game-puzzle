'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

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

type DragState = {
  pieceIds: string[];
  offset: Point;
};

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

export default function PuzzleTriangle({
  imageSrc = '/assets2600.jpg',
  rows = 4,
  cols = 4,
  snapThreshold = 20,
}) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [placedPieces, setPlacedPieces] = useState<Map<string, PlacedPiece>>(new Map());
  const [poolItems, setPoolItems] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize puzzle
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { pieces: trianglePieces, imageWidth, imageHeight } = await createTrianglePuzzle(
          imageSrc,
          rows,
          cols
        );
        setPieces(trianglePieces);
        setImageDimensions({ width: imageWidth, height: imageHeight });

        // Shuffle pieces
        const shuffled = [...trianglePieces.map(p => p.id)];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        setPoolItems(shuffled);
        setPlacedPieces(new Map());
      } catch (err) {
        console.error(err);
        alert('Failed to load image. Please check the image path.');
      } finally {
        setLoading(false);
      }
    })();
  }, [imageSrc, rows, cols]);

  // Check if puzzle is solved
  useEffect(() => {
    if (pieces.length === 0) return;
    if (poolItems.length > 0) return;

    const lockedCount = Array.from(placedPieces.values()).filter(p => p.isLocked).length;
    if (lockedCount === pieces.length) {
      setIsSolved(true);
      setTimeout(() => alert('🎉 Puzzle Complete! Fantastic work!'), 300);
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
        placed.connectedGroup.forEach(id => {
          if (!visited.has(id)) queue.push(id);
        });
      }
    }

    return Array.from(visited);
  }, [placedPieces]);

  // Check if piece should snap to neighbors
  const checkAndSnapToNeighbors = useCallback((pieceId: string, position: Point) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return { shouldSnap: false, snapPosition: position, neighbors: [] };

    const snapCandidates: { neighborId: string; snapPos: Point; dist: number }[] = [];

    // Check all neighbors
    Object.values(piece.neighbors).forEach(neighborId => {
      if (!neighborId) return;

      const neighborPlaced = placedPieces.get(neighborId);
      if (!neighborPlaced) return;

      const neighbor = pieces.find(p => p.id === neighborId);
      if (!neighbor) return;

      // Calculate where this piece should be relative to neighbor
      const offsetX = piece.correctPosition.x - neighbor.correctPosition.x;
      const offsetY = piece.correctPosition.y - neighbor.correctPosition.y;

      const expectedPos = {
        x: neighborPlaced.position.x + offsetX,
        y: neighborPlaced.position.y + offsetY
      };

      const dist = distance(position, expectedPos);

      if (dist < snapThreshold) {
        snapCandidates.push({
          neighborId,
          snapPos: expectedPos,
          dist
        });
      }
    });

    if (snapCandidates.length > 0) {
      // Snap to closest neighbor
      snapCandidates.sort((a, b) => a.dist - b.dist);
      const best = snapCandidates[0];

      // Collect all connected neighbors
      const allNeighbors = new Set<string>();
      snapCandidates.forEach(candidate => {
        allNeighbors.add(candidate.neighborId);
        const connectedGroup = getConnectedGroup(candidate.neighborId);
        connectedGroup.forEach(id => allNeighbors.add(id));
      });

      return {
        shouldSnap: true,
        snapPosition: best.snapPos,
        neighbors: Array.from(allNeighbors)
      };
    }

    return { shouldSnap: false, snapPosition: position, neighbors: [] };
  }, [pieces, placedPieces, snapThreshold, getConnectedGroup]);

  // Handle mouse down on pool piece
  const handlePoolPieceMouseDown = useCallback((e: React.MouseEvent, pieceId: string) => {
    e.preventDefault();
    setDragState({
      pieceIds: [pieceId],
      offset: { x: 0, y: 0 }
    });
  }, []);

  // Handle mouse down on placed piece
  const handlePlacedPieceMouseDown = useCallback((e: React.MouseEvent, pieceId: string) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const placed = placedPieces.get(pieceId);
    if (!placed) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Get all connected pieces
    const connectedGroup = getConnectedGroup(pieceId);

    setDragState({
      pieceIds: connectedGroup,
      offset: {
        x: mouseX - placed.position.x,
        y: mouseY - placed.position.y
      }
    });
  }, [placedPieces, getConnectedGroup]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const primaryPieceId = dragState.pieceIds[0];
    const newX = mouseX - dragState.offset.x;
    const newY = mouseY - dragState.offset.y;

    // Calculate offset for connected pieces
    const oldPlaced = placedPieces.get(primaryPieceId);
    const offsetX = oldPlaced ? newX - oldPlaced.position.x : 0;
    const offsetY = oldPlaced ? newY - oldPlaced.position.y : 0;

    // Update all pieces in the group
    setPlacedPieces(prev => {
      const newMap = new Map(prev);

      dragState.pieceIds.forEach(id => {
        const old = prev.get(id);
        if (id === primaryPieceId) {
          newMap.set(id, {
            id,
            position: { x: newX, y: newY },
            isLocked: false,
            connectedGroup: new Set()
          });
        } else if (old) {
          newMap.set(id, {
            ...old,
            position: {
              x: old.position.x + offsetX,
              y: old.position.y + offsetY
            },
            isLocked: false
          });
        }
      });

      return newMap;
    });

    // Remove from pool
    setPoolItems(prev => prev.filter(id => !dragState.pieceIds.includes(id)));
  }, [dragState, placedPieces]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    const primaryPieceId = dragState.pieceIds[0];
    const placed = placedPieces.get(primaryPieceId);

    if (placed) {
      const { shouldSnap, snapPosition, neighbors } = checkAndSnapToNeighbors(
        primaryPieceId,
        placed.position
      );

      if (shouldSnap && neighbors.length > 0) {
        const offsetX = snapPosition.x - placed.position.x;
        const offsetY = snapPosition.y - placed.position.y;

        setPlacedPieces(prev => {
          const newMap = new Map(prev);

          const allConnected = new Set([...dragState.pieceIds, ...neighbors]);

          dragState.pieceIds.forEach(id => {
            const old = prev.get(id);
            if (!old) return;

            newMap.set(id, {
              id,
              position: {
                x: old.position.x + offsetX,
                y: old.position.y + offsetY
              },
              isLocked: true,
              connectedGroup: new Set([...allConnected].filter(cId => cId !== id))
            });
          });

          neighbors.forEach(neighborId => {
            const neighbor = prev.get(neighborId);
            if (!neighbor) return;

            newMap.set(neighborId, {
              ...neighbor,
              connectedGroup: new Set([...allConnected].filter(cId => cId !== neighborId))
            });
          });

          return newMap;
        });
      }
    }

    setDragState(null);
  }, [dragState, placedPieces, checkAndSnapToNeighbors]);

  // Handle return to pool
  const handleReturnToPool = useCallback((pieceId: string) => {
    const connectedGroup = getConnectedGroup(pieceId);

    setPlacedPieces(prev => {
      const newMap = new Map(prev);
      connectedGroup.forEach(id => newMap.delete(id));
      return newMap;
    });

    setPoolItems(prev => [...prev, ...connectedGroup]);
  }, [getConnectedGroup]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-900 mb-3">Creating triangle puzzle...</div>
          <div className="text-amber-700">Cutting pieces with precision</div>
        </div>
      </div>
    );
  }

  const maxSize = 600;
  const scale = Math.min(1, maxSize / Math.max(imageDimensions.width, imageDimensions.height));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold mb-2"
            style={{
              fontFamily: 'Georgia, serif',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
            Triangle Jigsaw Puzzle
          </h1>
          <p className="text-gray-700 text-lg">
            {pieces.length} triangular pieces • Zero gaps • Perfect fit
          </p>
        </div>

        {isSolved && (
          <div className="bg-gradient-to-r from-emerald-100 to-teal-100 border-2 border-emerald-500 p-6 mb-6 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-bold text-emerald-800 mb-2">🎉 Perfect! Puzzle Complete! 🎉</div>
            <p className="text-emerald-700">Every triangle in its place!</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Puzzle Board - Left */}
          <div className="flex-1 lg:order-1">
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-4xl">🧩</span> Puzzle Board
              </h2>

              <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl shadow-inner p-8 mx-auto"
                style={{ width: 'fit-content' }}>
                <div
                  ref={canvasRef}
                  className="relative bg-white/60 rounded-xl overflow-visible mx-auto"
                  style={{
                    width: `${imageDimensions.width * scale}px`,
                    height: `${imageDimensions.height * scale}px`,
                    minHeight: '400px'
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
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
                            ? 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))'
                            : 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
                          transition: placed.isLocked ? 'filter 0.2s ease' : 'none',
                        }}
                        onMouseDown={(e) => handlePlacedPieceMouseDown(e, pieceId)}
                        onDoubleClick={() => handleReturnToPool(pieceId)}
                      >
                        <img
                          src={piece.src}
                          alt=""
                          className="w-full h-full object-contain pointer-events-none select-none"
                          draggable={false}
                          style={{
                            imageRendering: 'crisp-edges'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-sm text-orange-600 mt-4 text-center font-medium">
                💡 Double-click pieces to return them to the pool
              </p>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-96 lg:order-2 flex flex-col gap-6">
            {/* Pieces Pool */}
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-200 flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-3">
                  <span className="text-4xl">📦</span> Pieces
                </span>
                <span className="text-lg font-semibold bg-yellow-200 text-yellow-900 px-4 py-1.5 rounded-full">
                  {poolItems.length}
                </span>
              </h2>

              <div className="grid grid-cols-3 gap-3 p-5 border-2 border-dashed border-yellow-400 rounded-xl min-h-[300px] max-h-[450px] overflow-y-auto bg-yellow-50/30">
                {poolItems.map(id => {
                  const piece = pieces.find(p => p.id === id);
                  if (!piece) return null;

                  return (
                    <div
                      key={id}
                      className="aspect-square cursor-grab hover:scale-110 active:scale-95 transition-all bg-white rounded-lg shadow hover:shadow-xl p-1.5"
                      onMouseDown={(e) => handlePoolPieceMouseDown(e, id)}
                    >
                      <img
                        src={piece.src}
                        alt=""
                        className="w-full h-full object-contain pointer-events-none select-none"
                        draggable={false}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reference Image */}
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                <span className="text-4xl">🖼️</span> Reference
              </h2>
              <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-gray-300">
                <img
                  src={imageSrc}
                  alt="Reference"
                  className="w-full h-auto opacity-60 hover:opacity-100 transition-opacity duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center italic">
                Hover to see the complete image
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-8 border-2 border-indigo-200 shadow-lg">
          <h3 className="text-2xl font-bold text-indigo-900 mb-5 flex items-center gap-3">
            <span className="text-3xl">💡</span> How to Play
          </h3>
          <div className="grid md:grid-cols-2 gap-5 text-indigo-900">
            <div className="flex items-start gap-4 bg-white/50 rounded-xl p-4">
              <span className="text-3xl flex-shrink-0">🖱️</span>
              <p className="pt-1"><strong>Drag triangles</strong> from the pool onto the board</p>
            </div>
            <div className="flex items-start gap-4 bg-white/50 rounded-xl p-4">
              <span className="text-3xl flex-shrink-0">🧲</span>
              <p className="pt-1"><strong>Auto-snap</strong> when dragged near matching edges</p>
            </div>
            <div className="flex items-start gap-4 bg-white/50 rounded-xl p-4">
              <span className="text-3xl flex-shrink-0">🔗</span>
              <p className="pt-1"><strong>Connected groups</strong> move together seamlessly</p>
            </div>
            <div className="flex items-start gap-4 bg-white/50 rounded-xl p-4">
              <span className="text-3xl flex-shrink-0">✨</span>
              <p className="pt-1"><strong>Green glow</strong> shows correctly locked pieces</p>
            </div>
          </div>
        </div>

        {/* New Puzzle Button */}
        <div className="text-center mt-10">
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-pink-500/50 transform hover:scale-105 transition-all duration-200"
          >
            🔄 New Puzzle
          </button>
        </div>
      </div>
    </div>
  );
}