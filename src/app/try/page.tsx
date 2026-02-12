// app/puzzle-demo/page.tsx
'use client';

import { useState } from 'react';
import PuzzleGame from '@/components/puzzleGame';

export default function PuzzleDemoPage() {
    const [config, setConfig] = useState({
        imageSrc: '/assets1000.jpg',
        rows: 3,
        cols: 3,
        mode: 'partial' as 'partial' | 'empty',
        usePuzzleShapes: true, // Default to puzzle shapes for seamless interlocking
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 py-8">
            <div className="max-w-7xl mx-auto px-4">
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h1 className="text-4xl font-bold text-center mb-2">
                        🧩 Puzzle Game Demo
                    </h1>
                    <p className="text-center text-gray-600 mb-6">
                        Support gambar square & non-square dengan opsi puzzle shapes
                    </p>

                    {/* Configuration Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium mb-2">Gambar</label>
                            <select
                                value={config.imageSrc}
                                onChange={(e) => setConfig({ ...config, imageSrc: e.target.value })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="/assets1000.jpg">Square Image</option>
                                <option value="/assets.jpg">Landscape (16:9)</option>
                                <option value="/portrait.jpg">Portrait (9:16)</option>
                                <option value="/wide.jpg">Wide (21:9)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Rows</label>
                            <select
                                value={config.rows}
                                onChange={(e) => setConfig({ ...config, rows: Number(e.target.value) })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Columns</label>
                            <select
                                value={config.cols}
                                onChange={(e) => setConfig({ ...config, cols: Number(e.target.value) })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Mode</label>
                            <select
                                value={config.mode}
                                onChange={(e) => setConfig({ ...config, mode: e.target.value as 'partial' | 'empty' })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="partial">Partial (sebagian sudah ada)</option>
                                <option value="empty">Empty (kosong semua)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Piece Shape</label>
                            <select
                                value={config.usePuzzleShapes ? 'puzzle' : 'rectangle'}
                                onChange={(e) => setConfig({ ...config, usePuzzleShapes: e.target.value === 'puzzle' })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="rectangle">Rectangle (Simple)</option>
                                <option value="puzzle">Puzzle Shapes (Realistic)</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition-colors"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Puzzle Component */}
                <PuzzleGame
                    key={`${config.imageSrc}-${config.rows}-${config.cols}-${config.mode}-${config.usePuzzleShapes}`}
                    imageSrc={config.imageSrc}
                    rows={config.rows}
                    cols={config.cols}
                    mode={config.mode}
                    usePuzzleShapes={config.usePuzzleShapes}
                />

                {/* Information Section */}
                <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold mb-4">📋 Fitur Utama</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-lg mb-2 text-blue-600">
                                ✅ Support Semua Aspect Ratio
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                <li>Square (1:1)</li>
                                <li>Landscape (16:9, 21:9, dll)</li>
                                <li>Portrait (9:16, dll)</li>
                                <li>Custom ratio apapun</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2 text-purple-600">
                                🧩 Dua Mode Piece
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                <li><strong>Rectangle:</strong> Simple, cepat load</li>
                                <li><strong>Puzzle Shapes:</strong> Realistic dengan tab & slot</li>
                                <li>Random tab generation untuk variasi</li>
                                <li>SVG path untuk smooth edges</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2 text-green-600">
                                🎮 Gameplay Features
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                <li>Drag & drop interaction</li>
                                <li>Validasi posisi piece</li>
                                <li>Partial atau empty start</li>
                                <li>Visual feedback saat drag</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2 text-orange-600">
                                ⚙️ Customizable
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                <li>Rows & columns adjustable</li>
                                <li>Custom gambar path</li>
                                <li>Toggle puzzle shapes on/off</li>
                                <li>Responsive design</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Code Example */}
                <div className="mt-8 bg-gray-900 text-gray-100 rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold mb-4 text-white">💻 Cara Pakai</h2>
                    <pre className="bg-gray-800 p-4 rounded overflow-x-auto">
                        {`// Rectangle pieces (simple & cepat)
<PuzzleGame
  imageSrc="/your-image.jpg"
  rows={3}
  cols={3}
  mode="partial"
  usePuzzleShapes={false}
/>

// Puzzle shapes (realistic)
<PuzzleGame
  imageSrc="/landscape-photo.jpg"
  rows={4}
  cols={6}
  mode="empty"
  usePuzzleShapes={true}
/>

// Non-square image akan otomatis menyesuaikan!`}
                    </pre>
                </div>
            </div>
        </div>
    );
}