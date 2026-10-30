/**
 * Minimal FortiOS CLI reader and writer.
 *
 * Reads a config into a tree of config/edit blocks and set statements, so code
 * can move, remove and rewrite lines by structure instead of by regex, then
 * writes it back out. Lines nobody touches come back byte for byte, including
 * blank lines, comments, indentation and line endings.
 */

export interface SetNode {
    kind: "set";
    /** set, unset, append, ... */
    verb: string;
    key: string;
    /** The statement without indentation, e.g. `set ip 10.0.0.1 255.255.255.0`. */
    text: string;
    /** Original line. Dropped when the node is edited, so it gets re-indented. */
    raw?: string;
}

/** Anything that isn't structure or a statement: blank lines, comments, stray text. */
interface RawNode {
    kind: "raw";
    raw: string;
}

export interface ConfigNode {
    kind: "config";
    /** e.g. `system interface` */
    name: string;
    children: Node[];
    raw?: string;
    endRaw?: string;
}

export interface EditNode {
    kind: "edit";
    /** As written, so `"wan"` keeps its quotes. Use editName() to compare. */
    name: string;
    children: Node[];
    raw?: string;
    nextRaw?: string;
}

export type Node = SetNode | RawNode | ConfigNode | EditNode;

export interface Document {
    kind: "document";
    /** Line ending of the source, reused on output. */
    eol: string;
    children: Node[];
}

export type Container = Document | ConfigNode | EditNode;

const INDENT = "    ";
const STATEMENT_VERBS = new Set([
    "set",
    "unset",
    "append",
    "unappend",
    "select",
    "unselect",
]);

/* ------------------------------------------------------------------ */
/* Reading and writing                                                  */
/* ------------------------------------------------------------------ */

/** Throws when blocks don't balance, which means the text isn't a usable FortiOS config. */
export function parseFortiOS(text: string): Document {
    const doc: Document = {
        kind: "document",
        eol: text.includes("\r\n") ? "\r\n" : "\n",
        children: [],
    };
    const stack: Container[] = [doc];

    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        const word = line.split(/\s+/)[0];
        const top = stack[stack.length - 1];
        const where = `line ${index + 1}`;

        if (word === "config") {
            const node: ConfigNode = {
                kind: "config",
                name: line.slice(word.length).trim(),
                children: [],
                raw,
            };
            top.children.push(node);
            stack.push(node);
        } else if (word === "edit") {
            const node: EditNode = {
                kind: "edit",
                name: line.slice(word.length).trim(),
                children: [],
                raw,
            };
            top.children.push(node);
            stack.push(node);
        } else if (line === "end") {
            if (top.kind !== "config")
                throw new Error(`Unexpected "end" on ${where}.`);
            top.endRaw = raw;
            stack.pop();
        } else if (line === "next") {
            if (top.kind !== "edit")
                throw new Error(`Unexpected "next" on ${where}.`);
            top.nextRaw = raw;
            stack.pop();
        } else if (STATEMENT_VERBS.has(word)) {
            const key = line.split(/\s+/)[1] ?? "";
            top.children.push({
                kind: "set",
                verb: word,
                key,
                text: line,
                raw,
            });
        } else {
            top.children.push({ kind: "raw", raw });
        }
    });

    if (stack.length > 1) {
        const open = stack[stack.length - 1] as ConfigNode | EditNode;
        throw new Error(`"${open.kind} ${open.name}" is never closed.`);
    }
    return doc;
}

export function serializeFortiOS(doc: Document): string {
    const out: string[] = [];
    emit(doc.children, 0, out);
    return out.join(doc.eol);
}

function emit(nodes: Node[], depth: number, out: string[]): void {
    const pad = INDENT.repeat(depth);

    for (const node of nodes) {
        switch (node.kind) {
            case "raw":
                out.push(node.raw);
                break;
            case "set":
                out.push(node.raw ?? pad + node.text);
                break;
            case "config":
                out.push(node.raw ?? `${pad}config ${node.name}`);
                emit(node.children, depth + 1, out);
                out.push(node.endRaw ?? `${pad}end`);
                break;
            case "edit":
                out.push(node.raw ?? `${pad}edit ${node.name}`);
                emit(node.children, depth + 1, out);
                out.push(node.nextRaw ?? `${pad}next`);
                break;
        }
    }
}

/* ------------------------------------------------------------------ */
/* Looking things up                                                    */
/* ------------------------------------------------------------------ */

export const isConfig = (node: Node): node is ConfigNode =>
    node.kind === "config";
export const isEdit = (node: Node): node is EditNode => node.kind === "edit";

/** A `set` statement, optionally with a specific key. */
export const isSet = (node: Node, key?: string): node is SetNode =>
    node.kind === "set" &&
    node.verb === "set" &&
    (key === undefined || node.key === key);

export const unquote = (token: string): string =>
    token.length >= 2 && token.startsWith('"') && token.endsWith('"')
        ? token.slice(1, -1)
        : token;

/** Splits a value into tokens, keeping quoted strings together: `"a b" c` gives two. */
export const tokens = (value: string): string[] =>
    value.match(/"[^"]*"|\S+/g) ?? [];

/** Everything after the key: `set ip 1.2.3.4 255.255.255.0` gives `1.2.3.4 255.255.255.0`. */
export const valueOf = (node: SetNode): string =>
    node.text.replace(/^\S+\s+\S+\s*/, "");

export const editName = (node: EditNode): string => unquote(node.name);

export function findConfig(
    parent: Container,
    name: string,
): ConfigNode | undefined {
    return parent.children.filter(isConfig).find((node) => node.name === name);
}

export function findEdit(
    parent: Container,
    name: string,
): EditNode | undefined {
    return parent.children
        .filter(isEdit)
        .find((node) => editName(node) === name);
}

/**
 * Visits every node below `container`. `path` holds the containers from the
 * document down to the node's parent, so the last entry is the parent itself.
 * Safe to remove the visited node from its parent while visiting.
 */
export function walk(
    container: Container,
    visit: (node: Node, path: readonly Container[]) => void,
    path: readonly Container[] = [container],
): void {
    for (const node of [...container.children]) {
        visit(node, path);
        if (node.kind === "config" || node.kind === "edit")
            walk(node, visit, [...path, node]);
    }
}

/** Name of the closest `config ...` block around a node, e.g. `members` or `router static`. */
export function enclosingConfig(
    path: readonly Container[],
): string | undefined {
    for (let i = path.length - 1; i >= 0; i--) {
        const container = path[i];
        if (container.kind === "config") return container.name;
    }
    return undefined;
}

/* ------------------------------------------------------------------ */
/* Editing                                                              */
/* ------------------------------------------------------------------ */

export const newSet = (key: string, value: string): SetNode => ({
    kind: "set",
    verb: "set",
    key,
    text: `set ${key} ${value}`,
});

/** A new `edit` block from key/value pairs. The name is written as given, so pass `"wan"` quoted. */
export const newEdit = (
    name: string,
    lines: ReadonlyArray<readonly [key: string, value: string]>,
): EditNode => ({
    kind: "edit",
    name,
    children: lines.map(([key, value]) => newSet(key, value)),
});

export const newConfig = (name: string): ConfigNode => ({
    kind: "config",
    name,
    children: [],
});

/** Rewrites a statement's value; it gets re-indented on output. */
export function setValue(node: SetNode, value: string): void {
    node.text = `${node.verb} ${node.key} ${value}`;
    delete node.raw;
}

/** Removes and returns the first `set <key>` in a block. */
export function takeSet(parent: Container, key: string): SetNode | undefined {
    const index = parent.children.findIndex((node) => isSet(node, key));
    return index === -1
        ? undefined
        : (parent.children.splice(index, 1)[0] as SetNode);
}

export function removeNode(parent: Container, node: Node): void {
    const index = parent.children.indexOf(node);
    if (index !== -1) parent.children.splice(index, 1);
}
