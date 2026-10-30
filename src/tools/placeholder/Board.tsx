import { Circle, X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";
import type { Board as BoardState, Cell } from "./tictactoe";

const CELL_NAME: Record<NonNullable<Cell>, string> = { X: "your mark", O: "opponent's mark" };

interface BoardProps {
    board: BoardState;
    /** False while it isn't the player's turn or the game isn't running. */
    interactive: boolean;
    onPlay: (index: number) => void;
}

export function Board({ board, interactive, onPlay }: BoardProps) {
    const reduceMotion = useReducedMotion();

    return (
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#151A22]">
            {board.map((cell, index) => {
                const playable = interactive && cell === null;
                const row = Math.floor(index / 3) + 1;
                const column = (index % 3) + 1;

                return (
                    <button
                        key={index}
                        type="button"
                        disabled={!playable}
                        onClick={() => onPlay(index)}
                        aria-label={`Row ${row}, column ${column}, ${cell ? CELL_NAME[cell] : "empty"}`}
                        className={cn(
                            "flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-colors sm:h-28 sm:w-28",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50",
                            "dark:border-white/10 dark:bg-[#0F1218]",
                            playable
                                ? "cursor-pointer hover:border-slate-300 hover:bg-white dark:hover:border-white/25 dark:hover:bg-white/5"
                                : "cursor-default",
                        )}
                    >
                        {cell ? (
                            <m.span
                                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className={cell === "X" ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"}
                            >
                                {cell === "X" ? (
                                    <X className="h-12 w-12" strokeWidth={2.5} />
                                ) : (
                                    <Circle className="h-10 w-10" strokeWidth={2.5} />
                                )}
                            </m.span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
