'use client';

import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Piece } from '@/types/puzzle';
import { cn } from '@/lib/utils';

interface Props {
    piece: Piece;
    imageUrl: string;
    rows: number;
    cols: number;
    className?: string; // Add className support for extra styling if needed
}

export function PuzzlePiece({ piece, imageUrl, rows, cols, className }: Props) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: piece.id,
        data: piece, // Passthrough data for drag events
    });

    // If already placed (row/col is not null), we might render it differently?
    // The user snippet says: `if (piece.row !== null && piece.col !== null) return null;`
    // BUT: That logic assumes pieces in the grid are rendered differently or not draggable?
    // In the user's `PuzzleGrid`, they use `DroppableSlot` which renders `PuzzlePiece` inside.
    // Ideally, placed pieces might still be draggable (to correct mistakes)?
    // User snippet implies: "jika sudah placed, dirender di grid" -> THIS IS THE GRID COMPONENT? No, this is Piece.
    // Wait, if PuzzlePiece is used in BOTH Inventory AND Grid, then:
    // - In Inventory: row/col is null.
    // - In Grid: row/col is set.
    // The user snippet: `if (piece.row !== null && piece.col !== null) return null;` 
    // ONLY applies if this component is strictly for the Inventory? 
    // Let's check user's Grid usage: `<PuzzlePiece piece={piece} ... />` inside the slot.
    // So we SHOULD render it.

    // Actually, look at the snippet carefully:
    // `if (piece.row !== null && piece.col !== null) return null; // jika sudah placed, dirender di grid`
    // This return null suggests they might be rendering this list in the Inventory loop only?
    // BUT the user ALSO calls `<PuzzlePiece>` inside `PuzzleGrid`.
    // If I use the same component, I should NOT return null if it's placed, UNLESS I'm mapping the inventory list specifically.
    // Ideally components should be dumb. The PARENT decides whether to render it. 
    // So I will REMOVE that check `if (piece.row !== null...)`. The parent (Inventory list) should filter.
    // AND the parent (Grid slot) should render.

    // Formula for sliced background (only if imageUrl is provided)
    const isSliced = !!imageUrl && imageUrl.length > 0;

    // Formula from user request (for sliced):
    const posX = -(piece.correctPosition.x * (100 / cols));
    const posY = -(piece.correctPosition.y * (100 / rows));

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        backgroundImage: `url(${isSliced ? imageUrl : piece.url})`,
        backgroundSize: isSliced ? `${cols * 100}% ${rows * 100}%` : 'cover',
        backgroundPosition: isSliced ? `${posX}% ${posY}%` : 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: isDragging ? 50 : 1,
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={{ ...style }}
            className={cn(
                "bg-cover cursor-grab active:cursor-grabbing shadow-md rounded-md overflow-hidden touch-none",
                "w-20 h-20 md:w-24 md:h-24", // Default sizes, can be overridden by grid or parent
                className
            )}
            animate={{ scale: isDragging ? 1.05 : 1, zIndex: isDragging ? 50 : 1 }}
            {...listeners}
            {...attributes}
        >
            {/* optional: tambah nomor untuk debug */}
            {/* <span className="text-xs text-white bg-black/50 p-1">{piece.id}</span> */}
        </motion.div>
    );
}
