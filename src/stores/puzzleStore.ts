import { create } from "zustand";
import { LevelConfig, Piece, Position } from "@/types/puzzle";

interface PuzzleStore {
    // State
    currentLevel: LevelConfig | null;
    pieces: Piece[];
    score: number;
    attempts: number;
    isCompleted: boolean;
    startTime: number | null;

    // Actions
    setLevel: (level: LevelConfig) => void;
    movePiece: (pieceId: string, position: Position | null) => void;
    checkCompletion: () => boolean;
    incrementAttempts: () => void;
    resetLevel: () => void;
    clearLevel: () => void;
}

export const usePuzzleStore = create<PuzzleStore>((set, get) => ({
    // Initial state
    currentLevel: null,
    pieces: [],
    score: 0,
    attempts: 0,
    isCompleted: false,
    startTime: null,

    // Set level dan initialize pieces
    setLevel: (level) => {
        // Shuffle pieces untuk mode "full"
        const shuffledPieces =
            level.mode === "full"
                ? [...level.pieces].sort(() => Math.random() - 0.5)
                : level.pieces;

        set({
            currentLevel: level,
            pieces: shuffledPieces.map((p) => ({ ...p, currentPosition: null })),
            score: 0,
            attempts: 0,
            isCompleted: false,
            startTime: Date.now(),
        });
    },

    // Move piece ke posisi baru
    movePiece: (pieceId, position) => {
        set((state) => ({
            pieces: state.pieces.map((piece) =>
                piece.id === pieceId
                    ? { ...piece, currentPosition: position }
                    : piece
            ),
        }));
    },

    // Check apakah puzzle sudah lengkap
    checkCompletion: () => {
        const { pieces } = get();

        const allCorrect = pieces.every((piece) => {
            if (!piece.currentPosition) return false;
            return (
                piece.currentPosition.x === piece.correctPosition.x &&
                piece.currentPosition.y === piece.correctPosition.y
            );
        });

        if (allCorrect) {
            const timeTaken = Date.now() - (get().startTime || Date.now());
            const timeBonus = Math.max(0, 1000 - Math.floor(timeTaken / 1000));

            set({
                isCompleted: true,
                score: get().score + 100 + timeBonus,
            });
        }

        return allCorrect;
    },

    // Increment attempts
    incrementAttempts: () => {
        set((state) => ({ attempts: state.attempts + 1 }));
    },

    // Reset level (restart)
    resetLevel: () => {
        const { currentLevel } = get();
        if (currentLevel) {
            get().setLevel(currentLevel);
        }
    },

    // Clear level (back to home)
    clearLevel: () => {
        set({
            currentLevel: null,
            pieces: [],
            score: 0,
            attempts: 0,
            isCompleted: false,
            startTime: null,
        });
    },
}));