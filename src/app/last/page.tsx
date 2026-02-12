'use client';

import { useState, useRef, useEffect } from 'react';
import { Home, RefreshCw, Lightbulb, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Span } from 'next/dist/trace';

// Tipe untuk posisi
interface Position {
    x: number;
    y: number;
}

// Tipe untuk zone
interface DropZone {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isCorrect: boolean;
    snapX?: number; // Posisi snap X dalam pixel
    snapY?: number; // Posisi snap Y dalam pixel
}

export default function LionHabitatGame() {
    const [lionPosition, setLionPosition] = useState<Position>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPlaced, setIsPlaced] = useState(false);
    const [showVictory, setShowVictory] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
    const [attempts, setAttempts] = useState(0);
    const [startTime] = useState<number>(Date.now());
    const [elapsedTime, setElapsedTime] = useState('00:00');
    const [finalImageUrl, setFinalImageUrl] = useState<string>('');

    const lionRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Drop zones - posisi relatif terhadap container
    const dropZones: DropZone[] = [
        {
            id: 'sky',
            x: 30, // percentage
            y: 10,
            width: 20,
            height: 25,
            isCorrect: false,
        },
        {
            id: 'habitat',
            x: 60,
            y: 50,
            width: 25,
            height: 30,
            isCorrect: true,
            snapX: 65, // percentage untuk snap position
            snapY: 55,
        },
    ];

    // Timer effect
    useEffect(() => {
        if (!showVictory) {
            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                setElapsedTime(
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [showVictory, startTime]);

    // Konfetti generator
    useEffect(() => {
        if (showConfetti) {
            const timer = setTimeout(() => setShowConfetti(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showConfetti]);

    // Fungsi untuk menggabungkan background dan lion image
    const createFinalImage = async () => {
        if (!canvasRef.current || !containerRef.current || !lionRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerRect = containerRef.current.getBoundingClientRect();

        // Set canvas size
        canvas.width = containerRect.width;
        canvas.height = containerRect.height;

        try {
            // Load background image
            const bgImage = new Image();
            bgImage.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                bgImage.onload = resolve;
                bgImage.onerror = reject;
                bgImage.src = '/forest.jpg';
            });

            // Draw background
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

            // Load lion image
            const lionImage = new Image();
            lionImage.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                lionImage.onload = resolve;
                lionImage.onerror = reject;
                lionImage.src = 'https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=400&h=400&fit=crop';
            });

            // Calculate lion position and size
            const lionRect = lionRef.current!.getBoundingClientRect();
            const lionX = lionRect.left - containerRect.left;
            const lionY = lionRect.top - containerRect.top;
            const lionSize = Math.min(lionRect.width, lionRect.height) * 0.9;

            // Draw lion in circular shape
            ctx.save();
            ctx.beginPath();
            ctx.arc(
                lionX + lionRect.width / 2,
                lionY + lionRect.height / 2,
                lionSize / 2,
                0,
                Math.PI * 2
            );
            ctx.clip();
            ctx.drawImage(
                lionImage,
                lionX + (lionRect.width - lionSize) / 2,
                lionY + (lionRect.height - lionSize) / 2,
                lionSize,
                lionSize
            );
            ctx.restore();

            // Convert to data URL
            const finalImage = canvas.toDataURL('image/png');
            setFinalImageUrl(finalImage);
        } catch (error) {
            console.error('Error creating final image:', error);
            // Fallback to lion image only
            setFinalImageUrl('https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=800&h=450&fit=crop');
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isPlaced) return;

        e.preventDefault();
        setIsDragging(true);
        const rect = lionRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (isPlaced) return;

        e.preventDefault();
        setIsDragging(true);
        const touch = e.touches[0];
        const rect = lionRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
            });
        }
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = clientX - containerRect.left - dragOffset.x;
        const newY = clientY - containerRect.top - dragOffset.y;

        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            setLionPosition({ x: newX, y: newY });
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDragging) {
            e.preventDefault();
            handleMove(e.clientX, e.clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (isDragging) {
            e.preventDefault();
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
        }
    };

    const checkDropZone = () => {
        if (!containerRef.current || !lionRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const lionRect = lionRef.current.getBoundingClientRect();

        const lionCenterX = ((lionRect.left + lionRect.width / 2 - containerRect.left) / containerRect.width) * 100;
        const lionCenterY = ((lionRect.top + lionRect.height / 2 - containerRect.top) / containerRect.height) * 100;

        for (const zone of dropZones) {
            const inZoneX = lionCenterX >= zone.x && lionCenterX <= zone.x + zone.width;
            const inZoneY = lionCenterY >= zone.y && lionCenterY <= zone.y + zone.height;

            if (inZoneX && inZoneY) {
                setAttempts(prev => prev + 1);
                if (zone.isCorrect && zone.snapX !== undefined && zone.snapY !== undefined) {
                    // Snap to correct position
                    const snapX = (zone.snapX / 100) * containerRect.width - (lionRect.width / 2);
                    const snapY = (zone.snapY / 100) * containerRect.height - (lionRect.height / 2);

                    setLionPosition({ x: snapX, y: snapY });
                    setIsPlaced(true);
                    setShowConfetti(true);

                    // Create final image after snap animation
                    setTimeout(() => {
                        createFinalImage();
                        setTimeout(() => setShowVictory(true), 300);
                    }, 400);
                }
                break;
            }
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            checkDropZone();
        }
    };

    const handleTouchEnd = () => {
        if (isDragging) {
            setIsDragging(false);
            checkDropZone();
        }
    };

    const resetGame = () => {
        setLionPosition({ x: 0, y: 0 });
        setIsPlaced(false);
        setShowVictory(false);
        setShowConfetti(false);
        setAttempts(0);
        setFinalImageUrl('');
    };

    const handlePlayAgain = () => {
        setShowVictory(false);
        resetGame();
    };

    return (
        <div
            className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-sky-200 to-green-100 select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/forest.jpg"
                    alt="Jungle Habitat"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-green-500/10" />
            </div>

            {/* Floating Clouds */}
            <div className="absolute top-20 left-10 w-48 h-20 bg-white/40 rounded-full blur-xl animate-float opacity-80" />
            <div className="absolute top-40 right-20 w-64 h-24 bg-white/30 rounded-full blur-xl animate-float-delayed opacity-60" />
            <div className="absolute top-10 right-1/4 w-32 h-16 bg-white/50 rounded-full blur-xl animate-float-slow opacity-70" />

            {/* Confetti */}
            {showConfetti && (
                <div className="absolute inset-0 z-50 pointer-events-none">
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute animate-confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: '-10px',
                                width: '10px',
                                height: '10px',
                                backgroundColor: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'][i % 5],
                                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                                animationDelay: `${Math.random() * 0.5}s`,
                                animationDuration: `${2 + Math.random() * 2}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Main Game Container */}
            <div
                ref={containerRef}
                className="relative z-10 w-full h-screen flex flex-col justify-between p-4 md:p-8"
            >
                {/* Header Instruction */}
                <div className="flex justify-center">
                    <div className="glass-panel px-6 md:px-10 py-3 md:py-5 rounded-full shadow-xl flex items-center gap-3 md:gap-4 border-2 border-white/50 backdrop-blur-md bg-white/70">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                            <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                            </svg>
                        </div>
                        <h1 className="text-lg md:text-2xl font-bold text-gray-800">
                            Tarik dan letakkan Singa ke tempat yang tepat!
                        </h1>
                    </div>
                </div>

                {/* Drop Zones */}
                <div className="flex-grow flex items-center justify-center relative">
                    {/* Sky Zone (Incorrect) */}
                    <div
                        className="absolute group"
                        style={{
                            left: `${dropZones[0].x}%`,
                            top: `${dropZones[0].y}%`,
                            width: `${dropZones[0].width}%`,
                            height: `${dropZones[0].height}%`
                        }}
                    >
                        <div className="w-full h-full border-4 border-dashed border-red-400/60 rounded-xl flex flex-col items-center justify-center bg-red-500/10 group-hover:bg-red-500/20 transition-all duration-300">
                            <svg className="w-12 h-12 md:w-16 md:h-16 text-red-400/40 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="text-red-500 font-bold mt-2 text-sm md:text-base opacity-0 group-hover:opacity-100 transition-opacity">
                                Langit? Bukan di sini!
                            </span>
                        </div>
                    </div>

                    {/* Habitat Zone (Correct) */}
                    <div
                        className="absolute group"
                        style={{
                            left: `${dropZones[1].x}%`,
                            top: `${dropZones[1].y}%`,
                            width: `${dropZones[1].width}%`,
                            height: `${dropZones[1].height}%`
                        }}
                    >
                        <div className="w-full h-full border-4 border-dashed border-green-500 rounded-xl flex flex-col items-center justify-center bg-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] transition-all duration-300">
                            <svg className="w-16 h-16 md:w-24 md:h-24 text-green-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="text-gray-800 font-bold mt-2 bg-green-500 px-3 md:px-4 py-1 rounded-full text-sm md:text-base">
                                Rumah Singa!
                            </span>
                        </div>
                        {/* Pulse animation */}
                        <div className="absolute inset-0 bg-green-500/20 rounded-xl animate-ping opacity-20 pointer-events-none" />
                    </div>

                    {/* Draggable Lion */}
                    {!showVictory && (
                        <div
                            ref={lionRef}
                            className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} group ${isPlaced ? 'transition-all duration-500 ease-out' : ''}`}
                            style={{
                                left: lionPosition.x || '50%',
                                top: lionPosition.y || 'auto',
                                bottom: lionPosition.y ? 'auto' : '40px',
                                transform: lionPosition.x ? (isDragging ? 'scale(1.1)' : 'scale(1)') : 'translateX(-50%)',
                                transition: isPlaced ? 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : isDragging ? 'transform 0.1s ease-out' : 'transform 0.3s ease-out',
                                willChange: isDragging ? 'transform' : 'auto',
                                filter: isDragging
                                    ? 'drop-shadow(0 30px 60px rgba(0,0,0,0.5)) drop-shadow(0 0 40px rgba(255,193,7,0.6))'
                                    : 'drop-shadow(0 15px 40px rgba(0,0,0,0.35)) drop-shadow(0 0 20px rgba(255,193,7,0.3))',
                            }}
                            onMouseDown={handleMouseDown}
                            onTouchStart={handleTouchStart}
                        >
                            {/* Outer glow ring */}
                            <div className={`absolute inset-0 rounded-full transition-all duration-300 ${isDragging ? 'animate-pulse' : ''}`}
                                style={{
                                    background: 'radial-gradient(circle, rgba(255,193,7,0.5) 0%, rgba(255,165,0,0.3) 50%, transparent 70%)',
                                    filter: 'blur(25px)',
                                    transform: isDragging ? 'scale(1.2)' : 'scale(1)',
                                }}
                            />

                            {/* Image container - full size, no border */}
                            <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden shadow-2xl">
                                {/* Image with slight zoom effect on hover */}
                                <img
                                    src="https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=500&h=500&fit=crop"
                                    alt="Lion"
                                    className={`w-full h-full object-cover pointer-events-none select-none transition-transform duration-300 ${!isDragging && !isPlaced ? 'group-hover:scale-110' : ''} ${isDragging ? 'scale-105' : ''}`}
                                    draggable={false}
                                />

                                {/* Shine effect overlay */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                {/* Drag hint with enhanced styling */}
                                {!isDragging && !isPlaced && (
                                    <div className="absolute bottom-4 right-4 animate-bounce pointer-events-none">
                                        <div className="relative">
                                            {/* Glow effect behind icon */}
                                            <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-60" />
                                            {/* Icon background */}
                                            <div className="relative bg-gradient-to-br from-green-400 to-green-600 rounded-full p-3 shadow-2xl border-2 border-white/50">
                                                <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Sparkle effects when dragging */}
                                {isDragging && (
                                    <>
                                        <div className="absolute top-4 right-8 w-3 h-3 bg-yellow-300 rounded-full animate-ping" />
                                        <div className="absolute top-12 left-8 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                                        <div className="absolute bottom-10 right-10 w-3 h-3 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                                        <div className="absolute bottom-16 left-12 w-2 h-2 bg-orange-300 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
                                    </>
                                )}

                                {/* Edge glow when dragging */}
                                {isDragging && (
                                    <div className="absolute inset-0 rounded-full border-4 border-yellow-400/50 animate-pulse" />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-between items-end">
                    {/* Reset Button */}
                    <button
                        onClick={resetGame}
                        className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
                    >
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center text-red-500 shadow-lg border-4 border-red-100 group-hover:rotate-180 transition-transform duration-500">
                            <RefreshCw className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <span className="text-xs md:text-sm font-bold text-gray-800 bg-white/80 px-3 py-1 rounded-full">
                            Ulangi
                        </span>
                    </button>

                    {/* Hint Button */}
                    <button className="group flex flex-col items-center gap-2 transition-transform hover:scale-105">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500 rounded-full flex items-center justify-center text-gray-800 shadow-lg border-4 border-white/50 group-hover:scale-110 transition-transform">
                            <Lightbulb className="w-8 h-8 md:w-10 md:h-10" />
                        </div>
                        <span className="text-xs md:text-sm font-bold text-gray-800 bg-white/80 px-3 py-1 rounded-full">
                            Bantuan
                        </span>
                    </button>
                </div>
            </div>

            {/* Victory Modal */}
            {showVictory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white/90 backdrop-blur-md rounded-[3rem] p-6 md:p-10 max-w-[580px] w-full shadow-2xl border-2 border-white/80 animate-scale-in relative">
                        {/* Celebration Icons */}
                        <div className="absolute -top-6 -right-6 text-yellow-500 animate-bounce">
                            <svg className="w-12 h-12 md:w-16 md:h-16" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M2 11h5v2H2zm15 0h5v2h-5zm-6 6h2v5h-2zm0-15h2v5h-2zM4.22 5.64l1.42 1.42L8.46 4.24 7.04 2.82 4.22 5.64zM15.54 17.76l2.83 2.83 1.41-1.41-2.83-2.83-1.41 1.41zm-1.41-13.52l2.83-2.83 1.41 1.41-2.83 2.83-1.41-1.41zM6.05 17.76L3.22 20.59l1.41 1.41 2.83-2.83-1.41-1.41zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                            </svg>
                        </div>

                        {/* Stars */}
                        <div className="flex gap-2 justify-center items-end mb-4 h-20 md:h-24">
                            <svg className="w-14 h-14 md:w-16 md:h-16 text-yellow-400 transform -rotate-12 translate-y-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            <svg className="w-20 h-20 md:w-24 md:h-24 text-yellow-400 z-10 -translate-y-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            <svg className="w-14 h-14 md:w-16 md:h-16 text-yellow-400 transform rotate-12 translate-y-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 text-center mb-2 drop-shadow-lg">
                            Hebat Sekali!
                        </h1>
                        <p className="text-lg md:text-xl font-bold text-orange-400 uppercase tracking-widest bg-white/50 inline-block px-4 py-1 rounded-full text-center w-full mb-6 md:mb-8">
                            Kamu Menang!
                        </p>

                        {/* Completed Image */}
                        <div className="relative w-full p-2 bg-white rounded-[2rem] shadow-lg mb-6 md:mb-8">
                            <div className="relative w-full aspect-video rounded-[1.5rem] overflow-hidden">
                                <img
                                    src={finalImageUrl || 'https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?w=800&h=450&fit=crop'}
                                    alt="Completed Lion Puzzle"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-b from-yellow-400 to-orange-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center animate-bounce">
                                        <Trophy className="w-10 h-10 md:w-12 md:h-12 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex justify-center gap-4 w-full mb-6 md:mb-8">
                            <div className="flex-1 bg-orange-50 rounded-2xl p-3 flex flex-col items-center border border-orange-100 shadow-sm">
                                <span className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                                    Waktu
                                </span>
                                <span className="text-xl md:text-2xl font-black text-gray-700">
                                    {elapsedTime}
                                </span>
                            </div>
                            <div className="flex-1 bg-orange-50 rounded-2xl p-3 flex flex-col items-center border border-orange-100 shadow-sm">
                                <span className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                                    Percobaan
                                </span>
                                <span className="text-xl md:text-2xl font-black text-gray-700">
                                    {attempts}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 w-full">
                            <button
                                onClick={handlePlayAgain}
                                className="flex-[1.5] h-14 md:h-16 rounded-full flex items-center justify-center gap-3 bg-gradient-to-b from-green-400 to-green-600 shadow-lg hover:shadow-xl transition-all group"
                            >
                                <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white/20 rounded-full group-hover:scale-110 transition-transform">
                                    <svg className="w-5 h-5 md:w-6 md:h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                                <span className="text-white text-xl md:text-2xl font-black tracking-wide drop-shadow-md">
                                    MAIN LAGI
                                </span>
                            </button>
                            <Link href="/" className="flex-1 h-14 md:h-16 rounded-full flex items-center justify-center gap-2 bg-gradient-to-b from-blue-400 to-blue-600 shadow-lg hover:shadow-xl transition-all group">
                                <Home className="w-6 h-6 md:w-8 md:h-8 text-white group-hover:-translate-y-1 transition-transform" />
                                <span className="text-white text-lg md:text-xl font-black tracking-wide drop-shadow-md">
                                    MENU
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Decorative Elements */}
            <div className="fixed bottom-0 left-0 w-full h-24 pointer-events-none bg-gradient-to-t from-gray-900/20 to-transparent" />

            {/* Hidden canvas for generating final image */}
            <canvas ref={canvasRef} className="hidden" />

            <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes confetti {
          0% { 
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% { 
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes scale-in {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 7s ease-in-out infinite;
        }
        
        .animate-confetti {
          animation: confetti 3s linear forwards;
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
        }
        
        /* Smooth dragging with GPU acceleration */
        [data-dragging="true"] {
          will-change: transform;
          transform: translate3d(0, 0, 0);
        }
        
        /* Prevent text selection during drag */
        .select-none {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-user-drag: none;
          -webkit-touch-callout: none;
        }
      `}</style>
        </div>
    );
}