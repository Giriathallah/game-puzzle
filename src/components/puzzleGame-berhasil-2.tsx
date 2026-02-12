// components/PuzzleGameFixed.tsx
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
  // PERBAIKAN: Gunakan ukuran yang lebih kecil untuk tab agar konsisten
  const minDimension = Math.min(width, height);
  const tabSize = minDimension * 0.15; // Dikurangi dari 0.18
  const tabDepth = tabSize * 0.85; // Dikurangi dari 0.9

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

// PERBAIKAN: Split image dengan padding yang konsisten untuk semua aspect ratio
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

      // PERBAIKAN: Hitung padding berdasarkan dimensi terkecil agar konsisten
      const minDimension = Math.min(pieceWidth, pieceHeight);
      const tabSize = minDimension * 0.15;
      const padding = usePuzzleShapes ? tabSize * 1.0 : 0; // Dikurangi dari 1.1

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

            // Draw image piece
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

            // Draw border
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

// PERBAIKAN: Draggable Piece dengan positioning yang lebih akurat
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

  // Hitung ukuran total piece termasuk padding (tabs)
  const totalWidth = baseWidth + padding * 2;
  const totalHeight = baseHeight + padding * 2;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.8 : 1,
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

// PERBAIKAN: Droppable Slot dengan ukuran yang tepat
function DroppableSlot({
  index,
  piece,
  totalCols,
  baseWidth,
  baseHeight,
}: {
  index: number;
  piece: Piece | null;
  totalCols: number;
  baseWidth: number;
  baseHeight: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const isEmpty = !piece;

  const row = Math.floor(index / totalCols);
  const col = index % totalCols;

  return (
    <div
      ref={setNodeRef}
      id={`slot-${index}`}
      className={`relative transition-colors ${isEmpty
        ? isOver
          ? 'bg-green-200/40'
          : 'bg-white/10'
        : ''
        }`}
      style={{
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        margin: 0,
        padding: 0,
        overflow: 'visible',
        zIndex: isEmpty ? 0 : (row * 10 + col + 1),
      }}
    >
      {isEmpty && !isOver && (
        <div className="absolute inset-[2px] border border-dashed border-gray-300/40 rounded-sm pointer-events-none" />
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

export default function PuzzleJigsaw({
  imageSrc = '/assets1000.jpg',
  rows = 4,
  cols = 6,
  mode = 'partial' as PuzzleMode,
  usePuzzleShapes = true,
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

  // PERBAIKAN: Hitung ukuran grid dan piece yang tepat
  const pieceWidth = pieces.length > 0 ? pieces[0].baseWidth : 100;
  const pieceHeight = pieces.length > 0 ? pieces[0].baseHeight : 100;
  const gridWidth = pieceWidth * cols;
  const gridHeight = pieceHeight * rows;

  // Ukuran maksimal untuk display (scale down jika terlalu besar)
  const maxDisplayWidth = 600;
  const maxDisplayHeight = 600;
  const scale = Math.min(
    1,
    maxDisplayWidth / gridWidth,
    maxDisplayHeight / gridHeight
  );
  const displayWidth = gridWidth * scale;
  const displayHeight = gridHeight * scale;

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
            {/* PERBAIKAN: Wrapper dengan padding untuk overflow tab */}
            <div
              className="bg-gradient-to-br from-amber-100 to-orange-50 rounded-xl shadow-inner mx-auto flex items-center justify-center"
              style={{
                width: 'fit-content',
                maxWidth: '650px',
                // Padding untuk memungkinkan tab overflow
                padding: usePuzzleShapes ? `${Math.max(tabPadding * 2, 30)}px` : '24px',
              }}
            >
              <div
                className="relative bg-white/30 rounded-lg"
                style={{
                  // PERBAIKAN: Ukuran grid yang tepat dengan scaling
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, ${pieceWidth * scale}px)`,
                  gridTemplateRows: `repeat(${rows}, ${pieceHeight * scale}px)`,
                  gap: '0px',
                  overflow: 'visible',
                }}
              >
                {gridItems.map((id, index) => (
                  <DroppableSlot
                    key={index}
                    index={index}
                    piece={pieces.find(p => p.id === id) || null}
                    totalCols={cols}
                    baseWidth={pieceWidth * scale}
                    baseHeight={pieceHeight * scale}
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
          <li>✅ Sekarang bekerja untuk semua aspect ratio gambar</li>
          <li>✅ Tidak ada gap antar piece saat disusun</li>
          <li>✅ Bentuk puzzle piece konsisten untuk gambar landscape, portrait, atau square</li>
          <li>Set <code className="bg-gray-200 px-1 rounded">usePuzzleShapes=true</code> untuk bentuk puzzle piece</li>
          <li>Set <code className="bg-gray-200 px-1 rounded">usePuzzleShapes=false</code> untuk rectangle biasa</li>
        </ul>
      </div>
    </div>
  );
}