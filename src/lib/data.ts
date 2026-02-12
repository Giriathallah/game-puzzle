import { LevelConfig } from "@/types/puzzle";

// Helper function untuk generate pieces dengan posisi grid
const generatePieces = (
    baseUrl: string,
    gridSize: number,
    mode: "fill" | "full"
): LevelConfig["pieces"] => {
    const pieces = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;

        pieces.push({
            id: `piece-${i}`,
            // Gunakan picsum dengan seed untuk konsistensi
            url: `https://picsum.photos/seed/${baseUrl}-${i}/200/200`,
            correctPosition: { x: col, y: row },
            currentPosition: null, // belum ditempatkan
        });
    }
    return pieces;
};

export const LEVELS: Record<string, LevelConfig[]> = {
    fill: [
        {
            id: "fill-easy-1",
            name: "Hutan Tropis",
            mode: "fill",
            difficulty: "easy",
            backgroundUrl: "https://images.unsplash.com/photo-1511497584788-876760111969?w=800",
            pieces: generatePieces("forest", 2, "fill").slice(0, 4), // 2x2 = 4 pieces
            gridSize: 2,
            description: "Lengkapi gambar hutan dengan 4 bagian yang hilang",
        },
        {
            id: "fill-medium-1",
            name: "Kota Modern",
            mode: "fill",
            difficulty: "medium",
            backgroundUrl: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800",
            pieces: generatePieces("city", 3, "fill"), // 3x3 = 9 pieces
            gridSize: 3,
            description: "Lengkapi pemandangan kota dengan 9 bagian",
        },
        {
            id: "fill-hard-1",
            name: "Underwater World",
            mode: "fill",
            difficulty: "hard",
            backgroundUrl: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800",
            pieces: generatePieces("ocean", 4, "fill"), // 4x4 = 16 pieces
            gridSize: 4,
            description: "Lengkapi dunia bawah laut dengan 16 bagian",
        },
    ],
    full: [
        {
            id: "full-easy-1",
            name: "Kucing Lucu",
            mode: "full",
            difficulty: "easy",
            pieces: generatePieces("cat", 2, "full"),
            gridSize: 2,
            description: "Susun puzzle kucing 2x2",
        },
        {
            id: "full-medium-1",
            name: "Pemandangan Gunung",
            mode: "full",
            difficulty: "medium",
            pieces: generatePieces("mountain", 3, "full"),
            gridSize: 3,
            description: "Susun puzzle pemandangan 3x3",
        },
        {
            id: "full-hard-1",
            name: "Galaksi Bima Sakti",
            mode: "full",
            difficulty: "hard",
            pieces: generatePieces("galaxy", 4, "full"),
            gridSize: 4,
            description: "Susun puzzle galaksi 4x4",
        },
    ],
};

// Helper untuk get level by id
export const getLevelById = (id: string): LevelConfig | undefined => {
    return [...LEVELS.fill, ...LEVELS.full].find((level) => level.id === id);
};

// Helper untuk get levels by mode
export const getLevelsByMode = (mode: "fill" | "full"): LevelConfig[] => {
    return LEVELS[mode];
};