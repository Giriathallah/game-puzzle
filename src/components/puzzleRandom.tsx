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

// Predefined configurations for different piece counts
// Format: [rows, cols] to achieve target piece count
const PIECE_CONFIGURATIONS: Record<number, [number, number]> = {
  4: [1, 1],   // 1×1 = 4 triangles
  6: [1, 2],   // 1×2 = 6 triangles (varied)
  8: [2, 1],   // 2×1 = 8 triangles
  9: [2, 2],   // 2×2 = 9 triangles (varied)
  12: [2, 2],  // 2×2 = 12 triangles
  15: [2, 3],  // 2×3 = 15 triangles (varied)
  16: [2, 3],  // 2×3 = 16 triangles
  18: [3, 2],  // 3×2 = 18 triangles
  20: [3, 3],  // 3×3 = 20 triangles
  24: [3, 3],  // 3×3 = 24 triangles
  25: [3, 4],  // 3×4 = 25 triangles (varied)
  28: [3, 4],  // 3×4 = 28 triangles
  30: [4, 3],  // 4×3 = 30 triangles
  32: [4, 3],  // 4×3 = 32 triangles
  35: [4, 4],  // 4×4 = 35 triangles (varied)
  36: [4, 4],  // 4×4 = 36 triangles
  40: [4, 4],  // 4×4 = 40 triangles
  42: [4, 5],  // 4×5 = 42 triangles (varied)
  45: [4, 5],  // 4×5 = 45 triangles
  48: [5, 4],  // 5×4 = 48 triangles
  50: [5, 5],  // 5×5 = 50 triangles (varied)
};

// Get available piece counts
export const AVAILABLE_PIECE_COUNTS = Object.keys(PIECE_CONFIGURATIONS)
  .map(Number)
  .sort((a, b) => a - b);

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

// Generate varied triangle patterns
function generateTrianglePattern(
  topLeft: Point,
  topRight: Point,
  bottomLeft: Point,
  bottomRight: Point,
  row: number,
  col: number
): Point[][] {
  const patternType = (row * 7 + col * 13) % 6;

  switch (patternType) {
    case 0:
      return [
        [topLeft, topRight, bottomRight],
        [topLeft, bottomRight, bottomLeft]
      ];

    case 1:
      return [
        [topLeft, topRight, bottomLeft],
        [topRight, bottomRight, bottomLeft]
      ];

    case 2: {
      const midTopX = (topLeft.x + topRight.x) / 2;
      const midBottomX = (bottomLeft.x + bottomRight.x) / 2 + (bottomRight.x - bottomLeft.x) * 0.2;
      const midTop = { x: midTopX, y: topLeft.y };
      const midBottom = { x: midBottomX, y: bottomLeft.y };
      return [
        [topLeft, midTop, midBottom],
        [midTop, topRight, midBottom],
        [topRight, midBottom, bottomRight],
        [midBottom, bottomLeft, bottomRight]
      ];
    }

    case 3: {
      const midLeftY = (topLeft.y + bottomLeft.y) / 2;
      const midRightY = (topRight.y + bottomRight.y) / 2 + (bottomRight.y - topRight.y) * 0.2;
      const midLeft = { x: topLeft.x, y: midLeftY };
      const midRight = { x: topRight.x, y: midRightY };
      return [
        [topLeft, topRight, midRight],
        [topLeft, midRight, midLeft],
        [midLeft, midRight, bottomRight],
        [midLeft, bottomRight, bottomLeft]
      ];
    }

    case 4: {
      const centerX = (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4;
      const centerY = (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4;
      const center = { x: centerX, y: centerY };
      return [
        [topLeft, topRight, center],
        [topRight, bottomRight, center],
        [bottomRight, bottomLeft, center],
        [bottomLeft, topLeft, center]
      ];
    }

    case 5: {
      const offsetX = topLeft.x + (bottomRight.x - topLeft.x) * 0.7;
      const offsetY = topLeft.y + (bottomRight.y - topLeft.y) * 0.3;
      const offsetPoint = { x: offsetX, y: offsetY };
      return [
        [topLeft, topRight, offsetPoint],
        [topRight, bottomRight, offsetPoint],
        [offsetPoint, bottomRight, bottomLeft],
        [topLeft, offsetPoint, bottomLeft]
      ];
    }

    default:
      return [
        [topLeft, topRight, bottomRight],
        [topLeft, bottomRight, bottomLeft]
      ];
  }
}

// Create triangle mesh
async function createTrianglePuzzle(
  imageSrc: string,
  totalPieces: number,
  maxImageSize: number = 800
): Promise<{ pieces: Piece[]; imageWidth: number; imageHeight: number; scale: number }> {
  // Get rows and cols from configuration
  const config = PIECE_CONFIGURATIONS[totalPieces];
  if (!config) {
    throw new Error(`No configuration found for ${totalPieces} pieces. Available: ${AVAILABLE_PIECE_COUNTS.join(', ')}`);
  }

  const [rows, cols] = config;

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

        // Trim to exact target count if needed
        const targetCount = Math.min(totalPieces, allTriangles.length);
        const selectedTriangles = allTriangles.slice(0, targetCount);

        // Create pieces
        selectedTriangles.forEach(({ triangle, row, col, index }) => {
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

        console.log(`Created ${pieces.length} pieces successfully (target: ${totalPieces})`);

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

export default function PuzzleRandomShapes({
  imageSrc = '/assets2600.jpg',
  totalPieces = 24,
  snapThreshold = 20,
}) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [placedPieces, setPlacedPieces] = useState<Map<string, PlacedPiece>>(new Map());
  const [poolItems, setPoolItems] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize puzzle
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Loading puzzle with image:', imageSrc, 'pieces:', totalPieces);

        const { pieces: trianglePieces, imageWidth, imageHeight } = await createTrianglePuzzle(
          imageSrc,
          totalPieces,
          800
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

        console.log('Puzzle loaded successfully');
      } catch (err) {
        console.error('Error loading puzzle:', err);
        setError(err instanceof Error ? err.message : 'Failed to load puzzle');
      } finally {
        setLoading(false);
      }
    })();
  }, [imageSrc, totalPieces]);

  // Check if puzzle is solved
  useEffect(() => {
    if (pieces.length === 0) return;
    if (poolItems.length > 0) return;

    const lockedCount = Array.from(placedPieces.values()).filter(p => p.isLocked).length;
    if (lockedCount === pieces.length) {
      setIsSolved(true);
      setTimeout(() => alert('🎉 Puzzle Complete! Amazing work!'), 300);
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
      snapCandidates.sort((a, b) => a.dist - b.dist);
      const best = snapCandidates[0];

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

    const connectedGroup = getConnectedGroup(pieceId);

    setDragState({
      pieceIds: connectedGroup,
      offset: {
        x: mouseX - placed.position.x,
        y: mouseY - placed.position.y
      }
    });
  }, [placedPieces, getConnectedGroup]);

  // Mouse move with RAF
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

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

      setPoolItems(prev => prev.filter(id => !dragState.pieceIds.includes(id)));
    });
  }, [dragState, placedPieces]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

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

  // Cleanup RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-900 mb-3">Creating puzzle...</div>
          <div className="text-amber-700">Generating {totalPieces} varied triangle pieces</div>
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
            Varied Triangle Puzzle
          </h1>
          <p className="text-gray-700 text-lg">
            {pieces.length} unique pieces • Seamless interlocking • Drag & snap
          </p>
        </div>

        {isSolved && (
          <div className="bg-gradient-to-r from-emerald-100 to-teal-100 border-2 border-emerald-500 p-6 mb-6 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-bold text-emerald-800 mb-2">🎉 Perfect! Puzzle Complete! 🎉</div>
            <p className="text-emerald-700">Every piece in perfect harmony!</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Puzzle Board */}
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
                            ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))'
                            : 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))',
                          transition: placed.isLocked ? 'filter 0.2s ease' : 'none',
                          willChange: isDragging ? 'transform' : 'auto',
                        }}
                        onMouseDown={(e) => handlePlacedPieceMouseDown(e, pieceId)}
                        onDoubleClick={() => handleReturnToPool(pieceId)}
                      >
                        <img
                          src={piece.src}
                          alt=""
                          className="w-full h-full object-contain pointer-events-none select-none"
                          draggable={false}
                          style={{ imageRendering: 'auto' }}
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