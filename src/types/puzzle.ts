export interface Position {
    x: number;
    y: number;
}

export interface Piece {
    id: string;
    url: string;
    correctPosition: Position;
    currentPosition: Position | null; // null if in inventory
}

export interface LevelConfig {
    id: string;
    name: string;
    mode: "fill" | "full";
    difficulty: string;
    pieces: Piece[];
    gridSize: number;
    backgroundUrl?: string;
    description?: string;
}
