import { useCallback, useEffect, useReducer } from "react";
import { emptyBoard, getOutcome, pickAiMove, type Board, type Mark, type Outcome } from "./tictactoe";

export type Phase = "idle" | "playing" | "over";
type Turn = "player" | "ai";

interface GameState {
    phase: Phase;
    board: Board;
    turn: Turn;
    outcome: Outcome;
    score: { player: number; ai: number };
}

type GameAction =
    | { type: "start" }
    | { type: "play"; index: number }
    | { type: "aiPlay"; index: number };

const INITIAL_STATE: GameState = {
    phase: "idle",
    board: emptyBoard(),
    turn: "player",
    outcome: null,
    score: { player: 0, ai: 0 },
};

const AI_THINKING_MS = 600;

function place(state: GameState, index: number, mark: Mark): GameState {
    if (state.phase !== "playing" || state.board[index]) return state;

    const board = state.board.slice();
    board[index] = mark;

    const outcome = getOutcome(board);
    if (!outcome) return { ...state, board, turn: mark === "X" ? "ai" : "player" };

    return {
        ...state,
        board,
        outcome,
        phase: "over",
        score: {
            player: state.score.player + (outcome === "X" ? 1 : 0),
            ai: state.score.ai + (outcome === "O" ? 1 : 0),
        },
    };
}

function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case "start":
            return { ...state, phase: "playing", board: emptyBoard(), turn: "player", outcome: null };
        case "play":
            return state.turn === "player" ? place(state, action.index, "X") : state;
        case "aiPlay":
            return state.turn === "ai" ? place(state, action.index, "O") : state;
    }
}

/** Game state plus the opponent's turn, which fires after a short pause so it doesn't feel instant. */
export function useTicTacToe() {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

    useEffect(() => {
        if (state.phase !== "playing" || state.turn !== "ai") return;

        const timer = window.setTimeout(() => {
            const index = pickAiMove(state.board);
            if (index !== null) dispatch({ type: "aiPlay", index });
        }, AI_THINKING_MS);

        return () => window.clearTimeout(timer);
    }, [state.phase, state.turn, state.board]);

    const start = useCallback(() => dispatch({ type: "start" }), []);
    const play = useCallback((index: number) => dispatch({ type: "play", index }), []);

    return { ...state, canPlay: state.phase === "playing" && state.turn === "player", start, play };
}
