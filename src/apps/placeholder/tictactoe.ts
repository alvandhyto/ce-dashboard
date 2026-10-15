export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
/** A mark when someone has three in a row, "DRAW" when the board is full, null while play continues. */
export type Outcome = Mark | "DRAW" | null;

const WIN_LINES: ReadonlyArray<readonly [number, number, number]> = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

export const emptyBoard = (): Board => Array<Cell>(9).fill(null);

export function getOutcome(board: Board): Outcome {
    for (const [a, b, c] of WIN_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.every((cell) => cell !== null) ? "DRAW" : null;
}

/** The empty square that would give `mark` three in a row, if there is one. */
function completingMove(board: Board, mark: Mark): number | null {
    for (const line of WIN_LINES) {
        const cells = line.map((index) => board[index]);
        if (cells.filter((cell) => cell === mark).length === 2 && cells.includes(null)) {
            return line[cells.indexOf(null)];
        }
    }
    return null;
}

/** Opponent strategy: win if possible, otherwise block, otherwise any free square. */
export function pickAiMove(board: Board, random: () => number = Math.random): number | null {
    const free = board.flatMap((cell, index) => (cell === null ? [index] : []));
    if (free.length === 0) return null;

    return completingMove(board, "O") ?? completingMove(board, "X") ?? free[Math.floor(random() * free.length)];
}
