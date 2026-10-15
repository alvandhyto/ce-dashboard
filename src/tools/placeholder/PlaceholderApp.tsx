import { Folder, Play } from "lucide-react";
import type { AppProps } from "../../core/types";
import { AppHeader } from "../../components/layout/AppHeader";
import { AppShell } from "../../components/layout/AppShell";
import { containerClass } from "../../components/layout/container";
import { AppIcon } from "../../components/ui/AppIcon";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { Board } from "./Board";
import type { Outcome } from "./tictactoe";
import { useTicTacToe, type Phase } from "./useTicTacToe";

function statusText(phase: Phase, canPlay: boolean, outcome: Outcome): string {
    if (phase === "idle") return "Press start to play.";
    if (phase === "playing")
        return canPlay ? "Your turn" : "Opponent is thinking";
    if (outcome === "DRAW") return "It's a draw";
    return outcome === "X" ? "You won" : "You lost";
}

function Score({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">
                {label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {value}
            </span>
        </div>
    );
}

export default function PlaceholderApp({ onBack }: AppProps) {
    const { phase, board, outcome, score, canPlay, start, play } =
        useTicTacToe();

    return (
        <AppShell>
            <AppHeader
                title="Placeholder"
                subtitle="Tic-tac-toe against the computer"
                icon={
                    <AppIcon accent="amber" size="sm">
                        <Folder className="h-5 w-5" />
                    </AppIcon>
                }
                onBack={onBack}
                width="narrow"
                actions={
                    <div className="mr-2 flex items-center gap-4">
                        <Score label="You" value={score.player} />
                        <Score label="Opponent" value={score.ai} />
                    </div>
                }
            />

            <main
                className={cn(
                    containerClass("narrow"),
                    "flex flex-1 flex-col items-center justify-center gap-6 py-10",
                )}
            >
                <Board board={board} interactive={canPlay} onPlay={play} />

                <div className="flex flex-col items-center gap-4">
                    <p
                        role="status"
                        className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        {statusText(phase, canPlay, outcome)}
                    </p>
                    {phase !== "playing" && (
                        <Button
                            variant="primary"
                            accent="amber"
                            size="lg"
                            icon={<Play className="h-4 w-4" />}
                            onClick={start}
                        >
                            {phase === "over" ? "Play again" : "Start game"}
                        </Button>
                    )}
                </div>
            </main>
        </AppShell>
    );
}
