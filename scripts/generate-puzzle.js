const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration - can be overridden by command line arguments
// Usage: node scripts/generate-puzzle.js <source_image> <rows> <cols> <output_dir>
const SOURCE_IMAGE = process.argv[2] || './public/source.jpg';
const ROWS = parseInt(process.argv[3]) || 4;
const COLS = parseInt(process.argv[4]) || 4;
const OUTPUT_DIR = process.argv[5] || './public/puzzle-assets';

async function generatePuzzle() {
    try {
        if (!fs.existsSync(SOURCE_IMAGE)) {
            console.error(`Error: Source image not found at ${SOURCE_IMAGE}`);
            console.log('Usage: node scripts/generate-puzzle.js <source_image> <rows> <cols> <output_dir>');
            process.exit(1);
        }

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        const image = sharp(SOURCE_IMAGE);
        const metadata = await image.metadata();
        const width = metadata.width;
        const height = metadata.height;

        const partWidth = Math.floor(width / COLS);
        const partHeight = Math.floor(height / ROWS);

        console.log(`Processing image: ${width}x${height}`);
        console.log(`Grid: ${ROWS}x${COLS}, Part size: ${partWidth}x${partHeight}`);

        const puzzleData = [];

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const id = `part-${row}-${col}`;
                const fileName = `${id}.jpg`;
                const outputPath = path.join(OUTPUT_DIR, fileName);

                const left = col * partWidth;
                const top = row * partHeight;

                // Ensure we don't go out of bounds (might happen with rounding)
                // Sharp handles extraction, but input validation is good.
                // We stick to the floor values to ensure fit for all but maybe absolute edge pixels.
                // For a jigsaw, missing 1px at edge is better than crashing or sizing error.

                await image
                    .extract({ left, top, width: partWidth, height: partHeight })
                    .toFile(outputPath);

                puzzleData.push({
                    id,
                    imageUrl: `/puzzle-assets/${fileName}`, // Assuming public folder structure for web
                    correctPosition: { x: left, y: top },
                    grid: { row, col }
                });

                console.log(`Generated ${fileName}`);
            }
        }

        // Write JSON data
        const jsonPath = path.join(OUTPUT_DIR, 'puzzle-data.json');
        fs.writeFileSync(jsonPath, JSON.stringify({
            grid: { rows: ROWS, cols: COLS },
            pieceSize: { width: partWidth, height: partHeight },
            pieces: puzzleData
        }, null, 2));

        console.log(`Puzzle generation complete! Data saved to ${jsonPath}`);

    } catch (error) {
        console.error('Error generating puzzle:', error);
    }
}

generatePuzzle();
