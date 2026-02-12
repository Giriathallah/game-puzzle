// components/PuzzleRandomShapes.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types
type Point = { x: number; y: number };

type Piece = {
  id: string;
  src: string;
  correctIndex: number;
  polygon: Point[];
  svgPath: string;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  center: Point;
  correctPosition: Point; // Where the piece should be placed
};

type PlacedPiece = {
  id: string;
  position: Point; // Current position on canvas
  isLocked: boolean; // True if in correct position
};

type PuzzleMode = 'partial' | 'empty';

// Calculate distance between two points
function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Seeded random for reproducibility
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s * 9999) * 10000;
    return s - Math.floor(s);
  };
}

// Generate random points using Poisson disc sampling for even distribution
function generatePoissonDiscPoints(
  width: number,
  height: number,
  count: number,
  minDistance: number,
  seed: number
): Point[] {
  const random = seededRandom(seed);
  const points: Point[] = [];
  const cellSize = minDistance / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid: (Point | null)[][] = Array(gridWidth).fill(null).map(() => Array(gridHeight).fill(null));

  const active: Point[] = [];

  const firstPoint = {
    x: random() * width,
    y: random() * height
  };
  points.push(firstPoint);
  active.push(firstPoint);

  const gridX = Math.floor(firstPoint.x / cellSize);
  const gridY = Math.floor(firstPoint.y / cellSize);
  if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
    grid[gridX][gridY] = firstPoint;
  }

  while (active.length > 0 && points.length < count * 2) {
    const randomIndex = Math.floor(random() * active.length);
    const point = active[randomIndex];
    let found = false;

    for (let i = 0; i < 30; i++) {
      const angle = random() * Math.PI * 2;
      const radius = minDistance * (1 + random());
      const newPoint = {
        x: point.x + radius * Math.cos(angle),
        y: point.y + radius * Math.sin(angle)
      };

      if (newPoint.x < 0 || newPoint.x >= width || newPoint.y < 0 || newPoint.y >= height) {
        continue;
      }

      const gx = Math.floor(newPoint.x / cellSize);
      const gy = Math.floor(newPoint.y / cellSize);

      let valid = true;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight && grid[nx][ny]) {
            if (distance(newPoint, grid[nx][ny]!) < minDistance) {
              valid = false;
              break;
            }
          }
        }
        if (!valid) break;
      }

      if (valid) {
        points.push(newPoint);
        active.push(newPoint);
        if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
          grid[gx][gy] = newPoint;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(randomIndex, 1);
    }
  }

  while (points.length < count) {
    points.push({
      x: random() * width,
      y: random() * height
    });
  }

  return points.slice(0, count);
}

// Create Voronoi-like polygons with irregular wavy edges
function createIrregularVoronoiPolygons(
  seeds: Point[],
  width: number,
  height: number,
  waviness: number
): Point[][] {
  const polygons: Point[][] = [];

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const boundaryPoints: Point[] = [];

    const maxRadius = Math.max(width, height);
    const angleSteps = 72;

    for (let a = 0; a < angleSteps; a++) {
      const angle = (a / angleSteps) * Math.PI * 2;

      let foundBoundary = false;
      for (let r = 1; r < maxRadius && !foundBoundary; r += 2) {
        const testX = seed.x + Math.cos(angle) * r;
        const testY = seed.y + Math.sin(angle) * r;

        if (testX < 0 || testX >= width || testY < 0 || testY >= height) {
          const clampedX = Math.max(0, Math.min(width, testX));
          const clampedY = Math.max(0, Math.min(height, testY));

          const waveAmount = waviness * (Math.sin(angle * 7 + i) * 0.5 + 0.5);
          const perpX = -Math.sin(angle) * waveAmount;
          const perpY = Math.cos(angle) * waveAmount;

          boundaryPoints.push({
            x: clampedX + (clampedX > 0 && clampedX < width ? perpX : 0),
            y: clampedY + (clampedY > 0 && clampedY < height ? perpY : 0)
          });
          foundBoundary = true;
          break;
        }

        let closestSeed = i;
        let minDist = distance({ x: testX, y: testY }, seed);

        for (let j = 0; j < seeds.length; j++) {
          if (j !== i) {
            const dist = distance({ x: testX, y: testY }, seeds[j]);
            if (dist < minDist) {
              minDist = dist;
              closestSeed = j;
            }
          }
        }

        if (closestSeed !== i) {
          const prevR = r - 2;
          const boundaryR = prevR + 1;
          const boundaryX = seed.x + Math.cos(angle) * boundaryR;
          const boundaryY = seed.y + Math.sin(angle) * boundaryR;

          const waveFreq = 5 + (i % 3);
          const wavePhase = i * 0.7 + closestSeed * 0.3;
          const waveAmount = waviness * Math.sin(angle * waveFreq + wavePhase);
          const perpX = -Math.sin(angle) * waveAmount;
          const perpY = Math.cos(angle) * waveAmount;

          boundaryPoints.push({
            x: Math.max(0, Math.min(width, boundaryX + perpX)),
            y: Math.max(0, Math.min(height, boundaryY + perpY))
          });
          foundBoundary = true;
        }
      }
    }

    if (boundaryPoints.length > 2) {
      polygons.push(boundaryPoints);
    }
  }

  return polygons;
}

// Add extra irregularity to polygon edges
function addWavyEdges(polygon: Point[], waviness: number, seed: number): Point[] {
  if (polygon.length < 3) return polygon;

  const random = seededRandom(seed);
  const result: Point[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    result.push(current);

    const edgeLength = distance(current, next);
    const numPoints = Math.max(1, Math.floor(edgeLength / 15));

    for (let j = 1; j < numPoints; j++) {
      const t = j / numPoints;
      const baseX = current.x + (next.x - current.x) * t;
      const baseY = current.y + (next.y - current.y) * t;

      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / len;
      const perpY = dx / len;

      const wave1 = Math.sin(t * Math.PI * 4 + seed * 0.1) * waviness * 0.6;
      const wave2 = Math.sin(t * Math.PI * 7 + seed * 0.2) * waviness * 0.3;
      const wave3 = (random() - 0.5) * waviness * 0.4;
      const totalWave = wave1 + wave2 + wave3;

      result.push({
        x: baseX + perpX * totalWave,
        y: baseY + perpY * totalWave
      });
    }
  }

  return result;
}

// Convert polygon points to SVG path with smooth curves
function polygonToSmoothPath(polygon: Point[]): string {
  if (polygon.length < 3) return '';

  let path = `M ${polygon[0].x} ${polygon[0].y}`;

  for (let i = 0; i < polygon.length; i++) {
    const next = polygon[(i + 1) % polygon.length];
    const afterNext = polygon[(i + 2) % polygon.length];

    const cpX = next.x;
    const cpY = next.y;

    const endX = (next.x + afterNext.x) / 2;
    const endY = (next.y + afterNext.y) / 2;

    path += ` Q ${cpX} ${cpY} ${endX} ${endY}`;
  }

  path += ' Z';
  return path;
}

// Get bounding box of polygon
function getPolygonBounds(polygon: Point[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = polygon[0].x;
  let minY = polygon[0].y;
  let maxX = polygon[0].x;
  let maxY = polygon[0].y;

  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Get center of polygon
function getPolygonCenter(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };

  let sumX = 0, sumY = 0;
  for (const p of polygon) {
    sumX += p.x;
    sumY += p.y;
  }
  return { x: sumX / polygon.length, y: sumY / polygon.length };
}

// Split image into random irregular pieces
async function splitImageIntoRandomPieces(
  imageSrc: string,
  pieceCount: number
): Promise<{ pieces: Piece[]; imageWidth: number; imageHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      const pieces: Piece[] = [];
      const width = img.width;
      const height = img.height;

      const area = width * height;
      const avgArea = area / pieceCount;
      const minDistance = Math.sqrt(avgArea) * 0.6;
      const waviness = Math.sqrt(avgArea) * 0.08;

      const seed = Date.now();
      const seedPoints = generatePoissonDiscPoints(width, height, pieceCount, minDistance, seed);

      const basePolygons = createIrregularVoronoiPolygons(seedPoints, width, height, waviness);

      basePolygons.forEach((basePolygon, index) => {
        const wavyPolygon = addWavyEdges(basePolygon, waviness * 0.5, seed + index);

        if (wavyPolygon.length < 3) return;

        const bounds = getPolygonBounds(wavyPolygon);
        const center = getPolygonCenter(wavyPolygon);

        if (bounds.width < 10 || bounds.height < 10) return;

        const padding = 5;
        const canvasWidth = bounds.width + padding * 2;
        const canvasHeight = bounds.height + padding * 2;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.beginPath();

        const offsetPolygon = wavyPolygon.map(p => ({
          x: p.x - bounds.minX + padding,
          y: p.y - bounds.minY + padding
        }));

        ctx.moveTo(offsetPolygon[0].x, offsetPolygon[0].y);
        for (let i = 1; i < offsetPolygon.length; i++) {
          ctx.lineTo(offsetPolygon[i].x, offsetPolygon[i].y);
        }
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          img,
          bounds.minX - padding, bounds.minY - padding, canvasWidth, canvasHeight,
          0, 0, canvasWidth, canvasHeight
        );

        ctx.restore();

        const svgPath = polygonToSmoothPath(wavyPolygon);

        pieces.push({
          id: `piece-${index}`,
          src: canvas.toDataURL('image/png'),
          correctIndex: index,
          polygon: wavyPolygon,
          svgPath,
          bounds,
          center,
          correctPosition: { x: bounds.minX, y: bounds.minY }
        });
      });

      resolve({ pieces, imageWidth: width, imageHeight: height });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

export default function PuzzleRandomShapes({
  imageSrc = '/assets2600.jpg',
  pieceCount = 12,
  mode = 'empty' as PuzzleMode,
  snapThreshold = 30, // Distance threshold for snapping
}) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [placedPieces, setPlacedPieces] = useState<Map<string, PlacedPiece>>(new Map());
  const [poolItems, setPoolItems] = useState<string[]>([]);
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [isSolved, setIsSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { pieces: splitPieces, imageWidth, imageHeight } = await splitImageIntoRandomPieces(
          imageSrc,
          pieceCount
        );
        setPieces(splitPieces);
        setImageDimensions({ width: imageWidth, height: imageHeight });

        const shuffledIds = splitPieces.map((p: Piece) => p.id);

        for (let i = shuffledIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
        }

        if (mode === 'partial') {
          const placedCount = Math.floor(pieceCount * 0.3) + 1;
          const placedIndices = new Set<number>();

          while (placedIndices.size < placedCount && placedIndices.size < splitPieces.length) {
            placedIndices.add(Math.floor(Math.random() * splitPieces.length));
          }

          const newPlaced = new Map<string, PlacedPiece>();
          placedIndices.forEach(idx => {
            const piece = splitPieces[idx];
            if (piece) {
              newPlaced.set(piece.id, {
                id: piece.id,
                position: { ...piece.correctPosition },
                isLocked: true
              });
            }
          });

          const remainingIds = shuffledIds.filter((id: string) => {
            return !newPlaced.has(id);
          });

          setPlacedPieces(newPlaced);
          setPoolItems(remainingIds);
        } else {
          setPlacedPieces(new Map());
          setPoolItems(shuffledIds);
        }
      } catch (err) {
        console.error(err);
        alert('Failed to load image. Check the image path and console.');
      } finally {
        setLoading(false);
      }
    })();
  }, [imageSrc, pieceCount, mode]);

  // Check if puzzle is solved
  useEffect(() => {
    if (pieces.length === 0) return;
    if (poolItems.length > 0) return;

    const lockedCount = Array.from(placedPieces.values()).filter(p => p.isLocked).length;
    if (lockedCount === pieces.length) {
      setIsSolved(true);
      setTimeout(() => alert('Puzzle Complete! 🎉'), 300);
    }
  }, [placedPieces, poolItems, pieces]);

  const maxDisplayWidth = 600;
  const maxDisplayHeight = 600;
  const scale = Math.min(
    1,
    maxDisplayWidth / imageDimensions.width,
    maxDisplayHeight / imageDimensions.height
  );
  const displayWidth = imageDimensions.width * scale;
  const displayHeight = imageDimensions.height * scale;

  // Handle mouse down on a piece in pool
  const handlePoolPieceMouseDown = useCallback((e: React.MouseEvent, pieceId: string) => {
    e.preventDefault();
    setDraggedPiece(pieceId);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Handle mouse down on a placed piece
  const handlePlacedPieceMouseDown = useCallback((e: React.MouseEvent, pieceId: string) => {
    const placed = placedPieces.get(pieceId);
    if (placed?.isLocked) return; // Can't move locked pieces

    e.preventDefault();
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setDraggedPiece(pieceId);
    setDragOffset({
      x: mouseX - (placed?.position.x || 0) * scale,
      y: mouseY - (placed?.position.y || 0) * scale
    });
  }, [pieces, placedPieces, scale]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedPiece) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const piece = pieces.find(p => p.id === draggedPiece);
    if (!piece) return;

    // Update piece position
    const newX = (mouseX - dragOffset.x) / scale;
    const newY = (mouseY - dragOffset.y) / scale;

    setPlacedPieces(prev => {
      const newMap = new Map(prev);
      newMap.set(draggedPiece, {
        id: draggedPiece,
        position: { x: newX, y: newY },
        isLocked: false
      });
      return newMap;
    });

    // Remove from pool if it was there
    setPoolItems(prev => prev.filter(id => id !== draggedPiece));
  }, [draggedPiece, dragOffset, pieces, scale]);

  // Handle mouse up - check for snap
  const handleMouseUp = useCallback(() => {
    if (!draggedPiece) return;

    const piece = pieces.find(p => p.id === draggedPiece);
    const placed = placedPieces.get(draggedPiece);

    if (piece && placed) {
      // Check if close to correct position
      const dist = distance(placed.position, piece.correctPosition);

      if (dist < snapThreshold) {
        // Snap to correct position!
        setPlacedPieces(prev => {
          const newMap = new Map(prev);
          newMap.set(draggedPiece, {
            id: draggedPiece,
            position: { ...piece.correctPosition },
            isLocked: true
          });
          return newMap;
        });
      }
    }

    setDraggedPiece(null);
  }, [draggedPiece, pieces, placedPieces, snapThreshold]);

  // Handle dropping piece back to pool
  const handleReturnToPool = useCallback((pieceId: string) => {
    const placed = placedPieces.get(pieceId);
    if (placed?.isLocked) return;

    setPlacedPieces(prev => {
      const newMap = new Map(prev);
      newMap.delete(pieceId);
      return newMap;
    });
    setPoolItems(prev => [...prev, pieceId]);
  }, [placedPieces]);

  if (loading) return <div className="p-10 text-center">Loading puzzle...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-2">
        Random Cut Puzzle 🧩
      </h1>
      <p className="text-center text-gray-600 mb-6">
        {pieces.length} irregular pieces - drag near correct position to snap!
      </p>

      {isSolved && (
        <div className="bg-green-100 p-6 mb-6 rounded text-center text-2xl font-bold">
          Puzzle Complete! 🎉
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Puzzle Canvas */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Puzzle Area</h2>
          <div
            className="bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl shadow-inner mx-auto flex items-center justify-center p-4"
            style={{ width: 'fit-content', maxWidth: '650px' }}
          >
            <div
              ref={canvasRef}
              className="relative bg-gray-100 rounded-lg cursor-crosshair overflow-hidden"
              style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Placed pieces */}
              {Array.from(placedPieces.entries()).map(([pieceId, placed]) => {
                const piece = pieces.find(p => p.id === pieceId);
                if (!piece) return null;

                const padding = 5;

                return (
                  <div
                    key={pieceId}
                    className={`absolute select-none ${placed.isLocked ? 'cursor-default' : 'cursor-grab'}`}
                    style={{
                      left: `${(placed.position.x - padding) * scale}px`,
                      top: `${(placed.position.y - padding) * scale}px`,
                      width: `${(piece.bounds.width + padding * 2) * scale}px`,
                      height: `${(piece.bounds.height + padding * 2) * scale}px`,
                      zIndex: draggedPiece === pieceId ? 100 : placed.isLocked ? 10 : 20,
                      opacity: draggedPiece === pieceId ? 0.8 : 1,
                      transition: placed.isLocked ? 'all 0.2s ease-out' : 'none',
                    }}
                    onMouseDown={(e) => handlePlacedPieceMouseDown(e, pieceId)}
                    onDoubleClick={() => handleReturnToPool(pieceId)}
                  >
                    <img
                      src={piece.src}
                      alt=""
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                    {placed.isLocked && (
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ boxShadow: 'inset 0 0 0 2px rgba(34, 197, 94, 0.5)' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Double-click a piece to return it to the pool
          </p>
        </div>

        {/* Piece Pool */}
        <div className="flex-1 max-w-md">
          <h2 className="text-xl font-semibold mb-4">
            Remaining Pieces ({poolItems.length})
          </h2>
          <div
            className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4 border-2 border-dashed border-gray-400 rounded-lg min-h-[200px] bg-gray-50"
          >
            {poolItems.map(id => {
              const piece = pieces.find(p => p.id === id);
              return piece ? (
                <div
                  key={id}
                  className="aspect-square cursor-grab hover:scale-105 transition-transform"
                  onMouseDown={(e) => handlePoolPieceMouseDown(e, id)}
                >
                  <img
                    src={piece.src}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>

      <div className="text-center mt-10 space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
        >
          Play Again
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
        <p className="font-semibold mb-2">💡 How to Play:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>🖱️ Drag pieces from the pool onto the puzzle area</li>
          <li>🎯 Drop near the correct position - pieces will snap into place!</li>
          <li>🔗 Correctly placed pieces interlock seamlessly with zero gaps</li>
          <li>🔙 Double-click unlocked pieces to return them to the pool</li>
          <li>✅ Green highlight shows which pieces are locked in position</li>
        </ul>
      </div>
    </div>
  );
}