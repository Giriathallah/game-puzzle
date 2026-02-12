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
  // Metadata for positioning - how much the piece extends beyond base bounds
  padding: number;
  baseWidth: number;
  baseHeight: number;
};

type PuzzleMode = 'partial' | 'empty';

// Pre-generate tab pattern for interlocking pieces
// This ensures adjacent pieces have matching tabs/slots
function generateTabPattern(rows: number, cols: number): {
  horizontal: boolean[][];  // horizontal edges (rows+1 x cols)
  vertical: boolean[][];    // vertical edges (rows x cols+1)
} {
  // Create deterministic but varied pattern using indices
  const horizontal: boolean[][] = [];
  const vertical: boolean[][] = [];

  // Generate horizontal edge tabs (between rows)
  for (let row = 0; row <= rows; row++) {
    horizontal[row] = [];
    for (let col = 0; col < cols; col++) {
      // Edge pieces don't have tabs on borders
      if (row === 0 || row === rows) {
        horizontal[row][col] = false;
      } else {
        // Deterministic pattern based on position
        horizontal[row][col] = (row + col) % 2 === 0;
      }
    }
  }

  // Generate vertical edge tabs (between columns)
  for (let row = 0; row < rows; row++) {
    vertical[row] = [];
    for (let col = 0; col <= cols; col++) {
      // Edge pieces don't have tabs on borders
      if (col === 0 || col === cols) {
        vertical[row][col] = false;
      } else {
        // Deterministic pattern based on position (offset from horizontal)
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
  const tabSize = Math.min(width, height) * 0.18;
  const tabDepth = tabSize * 0.9;

  // Determine tab/slot for each edge
  // Top edge: if horizontal[row][col] is true, piece above has tab going down (we have slot going up)
  // Bottom edge: if horizontal[row+1][col] is true, we have tab going down
  // Left edge: if vertical[row][col] is true, piece to left has tab going right (we have slot going left)
  // Right edge: if vertical[row][col+1] is true, we have tab going right

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

  // Bottom edge (right to left)
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

  // Left edge (bottom to top)
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

// Split image dengan support non-square dan interlocking puzzle shapes
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

      // Generate tab pattern once for all pieces to ensure interlocking
      const tabPattern = generateTabPattern(rows, cols);
      const tabSize = Math.min(pieceWidth, pieceHeight) * 0.18;
      const padding = usePuzzleShapes ? tabSize * 1.1 : 0;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const canvas = document.createElement('canvas');
          canvas.width = pieceWidth + padding * 2;
          canvas.height = pieceHeight + padding * 2;

          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context error'));

          if (usePuzzleShapes) {
            // Generate interlocking puzzle path
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

            // Draw image piece - extend draw area to include tabs from neighbors
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

            // Draw subtle border/edge highlight for puzzle piece visibility
            ctx.save();
            ctx.translate(padding, padding);
            // Outer stroke (shadow effect)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke(path);
            // Inner highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke(path);
            ctx.restore();
          } else {
            // Simple rectangle pieces - no padding needed
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

  // Calculate how much larger the image is due to tabs (as percentage)
  const scaleX = baseWidth > 0 ? (baseWidth + padding * 2) / baseWidth : 1;
  const scaleY = baseHeight > 0 ? (baseHeight + padding * 2) / baseHeight : 1;
  const offsetPercent = padding > 0 && baseWidth > 0 ? (padding / baseWidth) * 100 : 0;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    // For grid pieces, we need to position them to account for tab overflow
    ...(isInGrid && padding > 0 ? {
      position: 'absolute' as const,
      width: `${scaleX * 100}%`,
      height: `${scaleY * 100}%`,
      left: `${-offsetPercent}%`,
      top: `${-offsetPercent}%`,
    } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-center ${isInGrid ? '' : 'w-full h-full'}`}
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

// Droppable Slot Component
function DroppableSlot({
  index,
  piece,
  totalCols,
}: {
  index: number;
  piece: Piece | null;
  totalCols: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const isEmpty = !piece;

  // Calculate row and col for z-index (pieces in later rows should be on top for proper tab overlap)
  const row = Math.floor(index / totalCols);
  const col = index % totalCols;

  return (
    <div
      ref={setNodeRef}
      id={`slot-${index}`}
      className={`relative overflow-visible transition-colors ${isEmpty
        ? isOver
          ? 'bg-green-200/40'
          : 'bg-white/10'
        : ''
        }`}
      style={{
        margin: 0,
        padding: 0,
        // Z-index based on position - later rows and cols on top for proper tab overlap
        zIndex: isEmpty ? 0 : (row * 10 + col + 1),
      }}
    >
      {/* Only show dotted outline on empty slots when not hovered */}
      {isEmpty && !isOver && (
        <div className="absolute inset-[2px] border border-dashed border-gray-300/40 rounded-sm pointer-events-none" />
      )}
      {piece && (
        <DraggablePiece
          id={piece.id}
          src={piece.src}
          isInGrid
          padding={piece.padding}
          baseWidth={piece.baseWidth}
          baseHeight={piece.baseHeight}
        />
      )}
    </div>
  );
}

export default function PuzzleJigsaw({
  imageSrc = '/assets1000.jpg',
  rows = 3,
  cols = 3,
  mode = 'partial' as PuzzleMode,
  usePuzzleShapes = true, // Toggle untuk menggunakan puzzle shapes atau rectangle biasa
}) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [gridItems, setGridItems] = useState<string[]>(Array(rows * cols).fill(''));
  const [poolItems, setPoolItems] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [tabPadding, setTabPadding] = useState(0);

  const totalSlots = rows * cols;
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

  // Check solved
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

  // Hitung aspect ratio dari gambar asli
  const gridAspectRatio = imageDimensions.width / imageDimensions.height;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-2">
        Puzzle {mode === 'partial' ? '(Lengkapi yang Ada)' : '(Susun dari Nol)'}
      </h1>
      <p className="text-center text-gray-600 mb-6">
        {usePuzzleShapes ? '🧩 Mode: Puzzle Shapes' : '📐 Mode: Rectangle Pieces'}
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
        <div className="flex flex-col lg:flex-row gap-8">
          {/* AREA PUZZLE */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-4">Area Puzzle</h2>
            {/* Outer wrapper with padding to allow tab overflow */}
            <div
              className="bg-gradient-to-br from-amber-100 to-orange-50 rounded-xl p-6 shadow-inner"
              style={{ maxWidth: '650px', margin: '0 auto' }}
            >
              <div
                className="grid mx-auto overflow-visible relative bg-white/30 rounded-lg"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: '0px',
                  aspectRatio: `${gridAspectRatio}`,
                  // Add padding to container to allow tabs to overflow without clipping
                  padding: usePuzzleShapes ? '4%' : '0',
                }}
              >
                {gridItems.map((id, index) => (
                  <DroppableSlot
                    key={index}
                    index={index}
                    piece={pieces.find(p => p.id === id) || null}
                    totalCols={cols}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* POOL */}
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
            <div
              className="shadow-2xl overflow-visible flex items-center justify-center"
              style={{
                width: '120px',
                height: '120px',
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
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

      <div className="text-center mt-10 space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
        >
          Main Ulang
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
        <p className="font-semibold mb-2">💡 Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Gambar non-square akan otomatis menyesuaikan aspect ratio</li>
          <li>Set <code className="bg-gray-200 px-1 rounded">usePuzzleShapes=true</code> untuk bentuk puzzle piece</li>
          <li>Set <code className="bg-gray-200 px-1 rounded">usePuzzleShapes=false</code> untuk rectangle biasa</li>
          <li>Drag piece ke posisi yang benar di grid</li>
          <li>Piece hanya bisa ditempatkan di posisi yang benar</li>
        </ul>
      </div>
    </div>
  );
}