import React, { useState, useEffect, useCallback } from "react";
import { ArrowRight, Circle, Folder, Moon, Play, Sun, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type Player = "X" | "O" | null;

export default function Placeholder({
    onBack,
    isDarkMode,
    toggleTheme,
}: {
    onBack: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}) {
    const [gameState, setGameState] = useState<"IDLE" | "PLAYING" | "GAMEOVER">(
        "IDLE",
    );
    const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [winner, setWinner] = useState<Player | "DRAW">(null);
    const [score, setScore] = useState({ player: 0, ai: 0 });

    const checkWinner = useCallback(
        (currentBoard: Player[]): Player | "DRAW" | null => {
            const lines = [
                [0, 1, 2],
                [3, 4, 5],
                [6, 7, 8], // Rows
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8], // Cols
                [0, 4, 8],
                [2, 4, 6], // Diagonals
            ];

            for (const [a, b, c] of lines) {
                if (
                    currentBoard[a] &&
                    currentBoard[a] === currentBoard[b] &&
                    currentBoard[a] === currentBoard[c]
                ) {
                    return currentBoard[a];
                }
            }

            if (currentBoard.every((cell) => cell !== null)) return "DRAW";
            return null;
        },
        [],
    );

    const makeAIMove = useCallback(
        (currentBoard: Player[]) => {
            const emptyIndices = currentBoard
                .map((v, i) => (v === null ? i : null))
                .filter((v): v is number => v !== null);
            if (emptyIndices.length === 0) return;

            // Simple AI: Try to win, then block player, then random
            const findBestMove = (symbol: Player) => {
                const lines = [
                    [0, 1, 2],
                    [3, 4, 5],
                    [6, 7, 8],
                    [0, 3, 6],
                    [1, 4, 7],
                    [2, 5, 8],
                    [0, 4, 8],
                    [2, 4, 6],
                ];
                for (const [a, b, c] of lines) {
                    const values = [
                        currentBoard[a],
                        currentBoard[b],
                        currentBoard[c],
                    ];
                    if (
                        values.filter((v) => v === symbol).length === 2 &&
                        values.includes(null)
                    ) {
                        return [a, b, c][values.indexOf(null)];
                    }
                }
                return null;
            };

            const winMove = findBestMove("O");
            const blockMove = findBestMove("X");

            const move =
                winMove ??
                blockMove ??
                emptyIndices[Math.floor(Math.random() * emptyIndices.length)];

            const newBoard = [...currentBoard];
            newBoard[move] = "O";
            setBoard(newBoard);

            const gameResult = checkWinner(newBoard);
            if (gameResult) {
                setWinner(gameResult);
                setGameState("GAMEOVER");
                if (gameResult === "O")
                    setScore((s) => ({ ...s, ai: s.ai + 1 }));
            } else {
                setIsPlayerTurn(true);
            }
        },
        [checkWinner],
    );

    useEffect(() => {
        if (gameState === "PLAYING" && !isPlayerTurn && !winner) {
            const timer = setTimeout(() => makeAIMove(board), 600);
            return () => clearTimeout(timer);
        }
    }, [gameState, isPlayerTurn, winner, board, makeAIMove]);

    const handleCellClick = (index: number) => {
        if (!isPlayerTurn || board[index] || gameState !== "PLAYING") return;

        const newBoard = [...board];
        newBoard[index] = "X";
        setBoard(newBoard);

        const gameResult = checkWinner(newBoard);
        if (gameResult) {
            setWinner(gameResult);
            setGameState("GAMEOVER");
            if (gameResult === "X")
                setScore((s) => ({ ...s, player: s.player + 1 }));
        } else {
            setIsPlayerTurn(false);
        }
    };

    const startGame = () => {
        setBoard(Array(9).fill(null));
        setWinner(null);
        setIsPlayerTurn(true);
        setGameState("PLAYING");
    };

    return (
        <div className="min-h-screen flex flex-col p-8 md:p-12 transition-colors font-sans overflow-hidden">
            <header className="max-w-6xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Folder className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Placeholder
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            LALALALALALALALALALALA
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 px-6 py-2 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-slate-800">
                        <div className="text-center">
                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                                You
                            </p>
                            <p className="text-sm font-black text-blue-500">
                                {score.player}
                            </p>
                        </div>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                                Opponent
                            </p>
                            <p className="text-sm font-black text-red-500">
                                {score.ai}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        {isDarkMode ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center relative">
                <div className="relative group p-12 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none">
                    <div className="grid grid-cols-3 gap-4 w-[300px] md:w-[400px]">
                        {board.map((cell, i) => (
                            <button
                                key={i}
                                onClick={() => handleCellClick(i)}
                                disabled={
                                    !!cell ||
                                    !isPlayerTurn ||
                                    gameState !== "PLAYING"
                                }
                                className={`h-[100px] md:h-[133px] bg-slate-100 dark:bg-white/5 border-2 border-transparent rounded-[1.5rem] flex items-center justify-center transition-all group/cell ${
                                    !cell &&
                                    isPlayerTurn &&
                                    gameState === "PLAYING"
                                        ? "hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:border-blue-100 dark:hover:border-blue-900/30 cursor-pointer"
                                        : "cursor-default"
                                }`}
                            >
                                <AnimatePresence mode="wait">
                                    {cell === "X" && (
                                        <motion.div
                                            initial={{
                                                scale: 0.5,
                                                opacity: 0,
                                                rotate: -45,
                                            }}
                                            animate={{
                                                scale: 1,
                                                opacity: 1,
                                                rotate: 0,
                                            }}
                                            className="text-blue-600"
                                        >
                                            <X className="w-12 h-12 md:w-16 md:h-16 stroke-[3]" />
                                        </motion.div>
                                    )}
                                    {cell === "O" && (
                                        <motion.div
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-red-500"
                                        >
                                            <Circle className="w-10 h-10 md:w-14 md:h-14 stroke-[3]" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </button>
                        ))}
                    </div>

                    <AnimatePresence>
                        {gameState !== "PLAYING" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/10 dark:bg-black/60 backdrop-blur-sm rounded-[3rem] flex flex-col items-center justify-center p-12 text-center"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, y: 20 }}
                                    animate={{ scale: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl max-w-sm w-full"
                                >
                                    <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6">
                                        <X className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
                                        {winner === "DRAW"
                                            ? "Draw"
                                            : winner
                                              ? winner === "X"
                                                  ? "You Won"
                                                  : "You Lost"
                                              : "Placeholder App"}
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">
                                        It's Tic-Tac-Toe.
                                    </p>

                                    <button
                                        onClick={startGame}
                                        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3"
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                        {gameState === "GAMEOVER"
                                            ? "Reset"
                                            : "Start Game"}
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="mt-12 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col items-center">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
                                Turn
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                {gameState === "PLAYING"
                                    ? isPlayerTurn
                                        ? "YOURS"
                                        : "OPPONENT'S"
                                    : "GAME HAS NOT STARTED"}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
