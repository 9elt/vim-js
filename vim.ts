const TAB_WIDTH = 4;

const PAGE_SIZE = 16;

const REPEAT_LIMIT = 128;

const UNDO_LIMIT = 128;

/*
 
trees
 
*/

enum Mode {
    COMMAND,
    INSERT,
    VISUAL,
};

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type Key = Digit | "ArrowLeft" | "ArrowDown" | "ArrowUp" | "ArrowRight"
    | "Enter" | "Backspace" | "Tab" | "Escape" | "PageUp" | "PageDown"
    | "End" | "Home" | "Insert" | "Delete"
    | "h" | "j" | "k" | "l" | "_" | "w" | "W" | "e" | "E" | "b" | "B" | "g"
    | "G" | "p" | "a" | "A" | "c" | "C" | "d" | "D" | "i" | "J" | "o" | "O"
    | "P" | "s" | "u" | "v" | "x" | "y" | ">" | "<" | "$" | "'" | '"' | "`"
    | "(" | ")" | "[" | "]" | "{" | "}" | "<" | ">"
    | "C-c" | "C-u" | "C-d" | "C-f" | "C-b" | "C-s";

type TextRange = [number, number];

type Select = (text: string, pos: number) => TextRange;

type Move = (text: string, pos: number) => number;

type Action = (vim: Vim, data: VimNodeData) => void;

type VimNodeData = Partial<{
    mode: Mode;
    select: Select;
    move: Move;
    action: Action;
    digit: Digit;
    dontSaveUndoState: boolean;
}>;

type VimNodes = {
    [K in Key]?: VimNode;
};

class VimNode {
    constructor(
        public data: VimNodeData = {},
        public nodes: VimNodes = {}
    ) { };
};

function isLeaf(vnode: VimNode) {
    for (const _ in vnode.nodes) {
        return false;
    }
    return true;
}

const digits = {
    "0": new VimNode({ action: actionZero, digit: "0" }),
    "1": new VimNode({ action: actionDigit, digit: "1" }),
    "2": new VimNode({ action: actionDigit, digit: "2" }),
    "3": new VimNode({ action: actionDigit, digit: "3" }),
    "4": new VimNode({ action: actionDigit, digit: "4" }),
    "5": new VimNode({ action: actionDigit, digit: "5" }),
    "6": new VimNode({ action: actionDigit, digit: "6" }),
    "7": new VimNode({ action: actionDigit, digit: "7" }),
    "8": new VimNode({ action: actionDigit, digit: "8" }),
    "9": new VimNode({ action: actionDigit, digit: "9" }),
};

const navigation = (data?: VimNodeData) => ({
    "0": new VimNode({ ...data, move: lineStart }),
    "_": new VimNode({ ...data, move: moveToFirstWordStart }),
    "$": new VimNode({ ...data, move: lineEnd }),
    "ArrowLeft": new VimNode({ ...data, move: moveLeft }),
    "ArrowDown": new VimNode({ ...data, move: moveDown }),
    "ArrowUp": new VimNode({ ...data, move: moveUp }),
    "ArrowRight": new VimNode({ ...data, move: moveRight }),
    "h": new VimNode({ ...data, move: moveLeft }),
    "j": new VimNode({ ...data, move: moveDown }),
    "k": new VimNode({ ...data, move: moveUp }),
    "l": new VimNode({ ...data, move: moveRight }),
    "Enter": new VimNode({ ...data, move: moveToWordNextLine }),
    "Backspace": new VimNode({ ...data, move: moveLeft }),
    "w": new VimNode({ ...data, move: moveToNextWord }),
    "W": new VimNode({ ...data, move: moveToNextWordPlus }),
    "e": new VimNode({ ...data, move: moveToEndWord }),
    "E": new VimNode({ ...data, move: moveToEndWordPlus }),
    "b": new VimNode({ ...data, move: moveToPreviousWord }),
    "B": new VimNode({ ...data, move: moveToPreviousWordPlus }),
    "g": new VimNode({}, {
        "g": new VimNode({ ...data, move: moveToVeryBeginning }),
    }),
    "G": new VimNode({ ...data, move: moveToVeryEnd }),
    "C-b": new VimNode({ ...data, move: movePageUp }),
    "C-f": new VimNode({ ...data, move: movePageDown }),
    "C-u": new VimNode({ ...data, move: moveHalfPageUp }),
    "C-d": new VimNode({ ...data, move: moveHalfPageDown }),
});

const a = new VimNode({}, {
    "p": new VimNode({ select: selectParagraphWithSpacesAfter }),
    "w": new VimNode({ select: selectWordWithSpacesAfter }),
    "W": new VimNode({ select: selectWordPlusWithSpacesAfter }),
    "'": new VimNode({ select: selectSingleQuotes }),
    '"': new VimNode({ select: selectDoubleQuotes }),
    '`': new VimNode({ select: selectBacktick }),
    "(": new VimNode({ select: selectBrackets }),
    ")": new VimNode({ select: selectBrackets }),
    "[": new VimNode({ select: selectSquares }),
    "]": new VimNode({ select: selectSquares }),
    "{": new VimNode({ select: selectBraces }),
    "}": new VimNode({ select: selectBraces }),
    "<": new VimNode({ select: selectAngles }),
    ">": new VimNode({ select: selectAngles }),
});

const i = new VimNode({}, {
    "p": new VimNode({ select: selectParagraph }),
    "w": new VimNode({ select: selectWord }),
    "W": new VimNode({ select: selectWordPlus }),
    "'": new VimNode({ select: inside(selectSingleQuotes) }),
    '"': new VimNode({ select: inside(selectDoubleQuotes) }),
    '`': new VimNode({ select: inside(selectBacktick) }),
    "(": new VimNode({ select: inside(selectBrackets) }),
    ")": new VimNode({ select: inside(selectBrackets) }),
    "[": new VimNode({ select: inside(selectSquares) }),
    "]": new VimNode({ select: inside(selectSquares) }),
    "{": new VimNode({ select: inside(selectBraces) }),
    "}": new VimNode({ select: inside(selectBraces) }),
    "<": new VimNode({ select: inside(selectAngles) }),
    ">": new VimNode({ select: inside(selectAngles) }),
});

const commandTree = new VimNode({}, {
    ...navigation({ action: actionMove }),
    ...digits,
    "a": new VimNode({ action: actionAppend }),
    "A": new VimNode({ action: actionAppendToEnd }),
    "c": new VimNode({ action: actionDeleteRange, mode: Mode.INSERT }, {
        ...navigation(),
        "a": a,
        "i": i,
        "c": new VimNode({ select: selectLine }),
        "w": new VimNode({ select: selectToWordBound }),
        "W": new VimNode({ select: selectToWordBoundPlus }),
    }),
    "C": new VimNode({ action: actionDeleteRange, move: lineEnd, mode: Mode.INSERT }),
    "d": new VimNode({ action: actionDeleteRange, mode: Mode.COMMAND }, {
        ...navigation(),
        "a": a,
        "i": i,
        "d": new VimNode({ select: selectLineNL }),
        "w": new VimNode({ select: selectToNextWord }),
        "W": new VimNode({ select: selectToNextWordPlus }),
    }),
    "D": new VimNode({ action: actionDeleteRange, move: lineEnd, mode: Mode.COMMAND }),
    "i": new VimNode({ action: actionInsert }),
    "J": new VimNode({ action: actionMergeLines }),
    "o": new VimNode({ action: actionInsertLineAfter }),
    "O": new VimNode({ action: actionInsertLineBefore }),
    "p": new VimNode({ action: actionPasteAfter }),
    "P": new VimNode({ action: actionPasteBefore }),
    "s": new VimNode({ action: actionDeleteChar, mode: Mode.INSERT }),
    "u": new VimNode({ action: actionUndo, dontSaveUndoState: true }),
    "v": new VimNode({ action: actionVisualMode }),
    "x": new VimNode({ action: actionDeleteChar }),
    "y": new VimNode({ action: actionYankRange }, {
        ...navigation(),
        "a": a,
        "i": i,
        "y": new VimNode({ select: selectLineNL }),
        "w": new VimNode({ select: selectToNextWord }),
        "W": new VimNode({ select: selectToNextWordPlus }),
    }),
    ">": new VimNode({ action: actionIncreaseIndent }, {
        ...navigation(),
        "a": a,
        "i": i,
        ">": new VimNode({ select: selectLine }),
    }),
    "<": new VimNode({ action: actionDecreaseIndent }, {
        ...navigation(),
        "a": a,
        "i": i,
        "<": new VimNode({ select: selectLine }),
    }),
    // TODO: "."
});

const visualTree = new VimNode({}, {
    ...navigation({ action: actionMove }),
    ...digits,
    "d": new VimNode({ action: actionDeleteCurrentSelection, mode: Mode.COMMAND }),
    "c": new VimNode({ action: actionDeleteCurrentSelection, mode: Mode.INSERT }),
    // TODO: "y"
    // TODO: "p"
    // TODO: ">"
    // TODO: "<"
});

/*
 
vim
 
*/

type Undo = {
    text: string;
    caret: number;
};

const RESERVED_KEYS = ["Shift", "Control", "Alt", "Meta", "AltGraph"];

export class Vim {
    mode: Mode = Mode.COMMAND;
    node: VimNode = commandTree;
    data: VimNodeData = {};
    sequence: string = "";
    digitbuf: string = "";
    clipboard: string = "";
    // TODO: Redo
    undostack: Undo[] = [];
    allowClipboardReset: boolean = false;
    selectionStart: number | null = null;
    constructor(public textarea: HTMLTextAreaElement) {
        textarea.addEventListener("keydown", (event) => {
            if (!RESERVED_KEYS.includes(event.key)) {
                onKey(this, (event.ctrlKey ? "C-" + event.key : event.key) as Key, event);
            }
        });
    };
};

function getText(vim: Vim) {
    return vim.textarea.value;
}

function setText(vim: Vim, text: string) {
    vim.textarea.value = text;
}

function getCaret(vim: Vim) {
    if (vim.mode === Mode.VISUAL) {
        return vim.textarea.selectionEnd === vim.selectionStart
            ? vim.textarea.selectionStart
            : vim.textarea.selectionEnd;
    }
    else {
        return vim.textarea.selectionEnd;
    }
}

function setCaret(vim: Vim, caret: number) {
    if (vim.mode === Mode.VISUAL) {
        vim.textarea.setSelectionRange(
            Math.min(caret, vim.selectionStart!),
            Math.max(caret, vim.selectionStart!)
        );
    }
    else {
        vim.textarea.setSelectionRange(caret, caret);
    }
}

function onKey(vim: Vim, key: Key, event: KeyboardEvent) {
    let passKeys: boolean | undefined;

    if (key === "Escape" || key === "C-c" || key === "C-s") {
        reset(vim);
        passKeys = false;
    }
    else if (vim.mode === Mode.INSERT) {
        if (key === "Enter") {
            actionEnterIndend(vim);
            passKeys = false;
        } else {
            passKeys = true;
        }
    }
    else if (key !== null) {
        acceptKey(vim, key);
        passKeys = false;
    }

    // TODO: Improve
    if (passKeys === false) {
        event.preventDefault();
        event.stopPropagation();
    }

    return passKeys;
}

function setMode(vim: Vim, mode: Mode) {
    if (vim.mode === mode) {
        return;
    }

    if (mode === Mode.VISUAL) {
        vim.selectionStart = getCaret(vim);
    }
    else if (vim.mode === Mode.VISUAL) {
        const caret = getCaret(vim);
        vim.selectionStart = null;
        vim.textarea.setSelectionRange(caret, caret);
    }

    vim.mode = mode;
}

function reset(vim: Vim) {
    setMode(vim, Mode.COMMAND);
    resetCommand(vim);
}

function resetCommand(vim: Vim) {
    vim.node = vim.mode === Mode.VISUAL
        ? visualTree
        : commandTree;
    vim.data = {};
    vim.sequence = "";
}

function acceptKey(vim: Vim, key: Key) {
    const node = vim.node.nodes[key];

    console.log(vim.sequence + key);

    if (!node) {
        resetCommand(vim);
        return;
    }

    vim.sequence += key;
    vim.node = node;
    vim.data = { ...vim.data, ...node.data };

    if (isLeaf(node)) {
        const repeat: number = vim.data.digit ? 1 :
            Math.max(0, Math.min(
                parseInt(vim.digitbuf || "1"),
                REPEAT_LIMIT
            ));

        if (!vim.data.digit) {
            vim.digitbuf = "";
        }

        vim.allowClipboardReset = true;

        if (!vim.data.dontSaveUndoState) {
            saveUndoState(vim);
        }

        if (vim.data.action) {
            for (var i = 0; i < repeat; i++) {
                vim.data.action(vim, vim.data);
            }
        }

        resetCommand(vim);
    }
}

function saveUndoState(vim: Vim) {
    const text = vim.textarea.value;

    const prev = vim.undostack[vim.undostack.length - 1];
    const prevText = prev && prev.text;

    if (text === prevText) {
        prev.caret = vim.textarea.selectionStart;
    }
    else {
        vim.undostack.push({
            text,
            caret: vim.textarea.selectionStart,
        });

        if (vim.undostack.length > UNDO_LIMIT) {
            vim.undostack.shift();
        }
    }
}

function clipboard(vim: Vim, text: string) {
    if (text) {
        if (vim.allowClipboardReset) {
            vim.allowClipboardReset = false;
            vim.clipboard = "";
        }

        vim.clipboard += text;

        if (typeof navigator !== "undefined") {
            navigator
                .clipboard
                .writeText(vim.clipboard)
                .catch(console.error);
        }
    }
}

function getSelection(vim: Vim, data: VimNodeData): TextRange {
    const text = getText(vim);
    const caret = getCaret(vim);

    if (data.select) {
        return data.select(text, caret);
    }

    if (data.move) {
        const mov = data.move(text, caret);
        return mov > caret ? [caret, mov] : [mov, caret];
    }

    return [0, 0];
}

function yank(vim: Vim, start: number, end: number, cut: boolean) {
    const text = getText(vim);

    clipboard(vim, text.slice(start, end));

    const result = text.slice(0, start) + text.slice(end);

    if (cut) {
        setText(vim, result);
    }

    setCaret(vim, start);

    return result;
}

/*

util

*/

function insertAt(text: string, pos: number, data: string) {
    return text.slice(0, pos) + data + text.slice(pos);
}

function countSpaces(text: string, pos: number, allow = " ") {
    let i = 0;
    let c: string;
    while ((c = text.charAt(pos + i)) && allow.includes(c)) {
        i++;
    }
    return i;
}

function lineStart(text: string, pos: number) {
    const i = text.lastIndexOf(
        "\n",
        text.charAt(pos) === "\n" ? pos - 1 : pos
    );
    return i === -1 ? 0 : i + 1;
}

function lineEnd(text: string, pos: number) {
    const i = text.indexOf("\n", pos);
    return i === -1 ? text.length : i;
}

function increaseIndent(str: string) {
    return str = " ".repeat(TAB_WIDTH) + str;
}

function decreaseIndent(str: string) {
    for (let i = 0; i < TAB_WIDTH; i++) {
        if (str.startsWith(" ")) {
            str = str.slice(1);
        }
    }
    return str;
}

function findRegexBreak(text: string, pos: number, regex: RegExp): TextRange {
    let l: number = 0;
    let r: number | undefined;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
        let i = match.index + 1;

        if (i <= pos) {
            l = i;
        }
        else if (r === undefined) {
            r = i;
        }
    }

    return [l, r === undefined ? text.length : r];
}

/*

select

*/

const START = 0;

const END = 1;

function inside(f: Select): Select {
    return (text, pos) => {
        const range = f(text, pos);

        return range[END] === range[START]
            ? range
            : [range[START] + 1, range[END] - 1];
    };
}

function selectLine(text: string, pos: number): TextRange {
    return [lineStart(text, pos), lineEnd(text, pos)];
}

function selectLineNL(text: string, pos: number): TextRange {
    return [lineStart(text, pos), lineEnd(text, pos) + 1];
}

const FIND_WORD = /(\\s(?=\\S))|([^\u0000-/:-@[-`{-¿](?=[\u0000-/:-@[-`{-¿]))|(\\S(?=\\s))|([\u0000-/:-@[-`{-¿](?=[^\u0000-/:-@[-`{-¿]))/g;

function selectWord(text: string, pos: number): TextRange {
    return findRegexBreak(text, pos, FIND_WORD);
}

const FIND_WORD_PLUS = /(\s(?=\S))|(\S(?=\s))/g;

function selectWordPlus(text: string, pos: number): TextRange {
    return findRegexBreak(text, pos, FIND_WORD_PLUS);
}

const FIND_PARAGRAPH = /\n\s*\n/g;

function selectParagraph(text: string, pos: number): TextRange {
    return findRegexBreak(text, pos, FIND_PARAGRAPH);
}

function selectToNextWord(text: string, pos: number): TextRange {
    return [pos, moveToNextWord(text, pos)];
}

function selectToNextWordPlus(text: string, pos: number): TextRange {
    return [pos, moveToNextWordPlus(text, pos)];
}

function selectToWordBound(text: string, pos: number): TextRange {
    return [pos, selectWord(text, pos)[END]];
}

function selectToWordBoundPlus(text: string, pos: number): TextRange {
    return [pos, selectWordPlus(text, pos)[END]];
}

function selectWordWithSpacesAfter(text: string, pos: number): TextRange {
    const [start, end] = selectWord(text, pos);
    return [start, end + countSpaces(text, end)];
}

function selectWordPlusWithSpacesAfter(text: string, pos: number): TextRange {
    const [start, end] = selectWordPlus(text, pos);
    return [start, end + countSpaces(text, end)];
}

function selectParagraphWithSpacesAfter(text: string, pos: number): TextRange {
    const [start, end] = selectParagraph(text, pos);
    return [start, end + countSpaces(text, end)];
}

function selectSingleQuotes(text: string, pos: number): TextRange {
    return selectQuotes(text, pos, "'");
}

function selectDoubleQuotes(text: string, pos: number): TextRange {
    return selectQuotes(text, pos, '"');
}

function selectBacktick(text: string, pos: number): TextRange {
    return selectQuotes(text, pos, "`");
}

// TODO: Improve
function selectQuotes(text: string, pos: number, quote: "'" | '"' | "`"): TextRange {
    let l: number | undefined;
    let r: number | undefined;

    for (let i = pos; i >= 0; i--) {
        if (text.charAt(i) === quote) {
            l = i;
            break;
        }
    }

    for (let i = pos + 1; i < text.length; i++) {
        if (text.charAt(i) === quote) {
            r = i;
            break;
        }
    }

    return [l || 0, (r || text.length) + 1];
}

function selectBrackets(text: string, pos: number): TextRange {
    return selectBounds(text, pos, "()");
}

function selectBraces(text: string, pos: number): TextRange {
    return selectBounds(text, pos, "{}");
}

function selectSquares(text: string, pos: number): TextRange {
    return selectBounds(text, pos, "[]");
}

function selectAngles(text: string, pos: number): TextRange {
    return selectBounds(text, pos, "<>");
}

// TODO: Improve
function selectBounds(text: string, pos: number, bounds: "()" | "[]" | "{}" | "<>"): TextRange {
    const start = bounds.charAt(START);
    const end = bounds.charAt(END);

    let l: number | undefined;
    let r: number | undefined;

    if (text.charAt(pos) === start) {
        l = pos;
    }
    else {
        let k = 1;

        for (let i = pos - 1; i >= 0; i--) {
            const char = text.charAt(i);

            k += (char === start ? -1 : 0) + (char === end ? 1 : 0);

            if (k === 0) {
                l = i;
                break;
            }
        }
    }

    if (text.charAt(pos) === end) {
        r = pos;
    }
    else {
        let k = 1;

        for (let i = pos + 1; i < text.length; i++) {
            const char = text.charAt(i);

            k += (char === start ? 1 : 0) + (char === end ? -1 : 0);

            if (k === 0) {
                r = i;
                break;
            }
        }
    }

    return (r === undefined || l === undefined) ? [pos, 0] : [l, r + 1]
}

/*

move

*/

function moveLeft(_: string, pos: number) {
    return Math.max(0, pos - 1);
}

function moveRight(text: string, pos: number) {
    return Math.min(text.length, pos + 1);
}

function moveDown(text: string, pos: number) {
    const ls = lineStart(text, pos);
    const le = lineEnd(text, pos);

    if (le === text.length) {
        return pos;
    }

    const nls = le + 1;
    const nle = lineEnd(text, nls);

    return nls + Math.min(pos - ls, nle - nls);
}

function moveUp(text: string, pos: number) {
    const ls = lineStart(text, pos);

    if (ls === 0) {
        return pos;
    }

    const ple = ls - 1;
    const pls = lineStart(text, ple);

    return pls + Math.min(pos - ls, ple - pls);
}

function moveHalfPageUp(text: string, pos: number) {
    for (let i = 0; i < PAGE_SIZE; i++) {
        pos = moveUp(text, pos);
    }
    return pos;
}

function moveHalfPageDown(text: string, pos: number) {
    for (let i = 0; i < PAGE_SIZE; i++) {
        pos = moveDown(text, pos);
    }
    return pos;
}

function movePageDown(text: string, pos: number) {
    pos = moveHalfPageDown(text, pos);
    pos = moveHalfPageDown(text, pos);
    return pos;
}

function movePageUp(text: string, pos: number) {
    pos = moveHalfPageUp(text, pos);
    pos = moveHalfPageUp(text, pos);
    return pos;
}

function moveToWordNextLine(text: string, pos: number) {
    const ls = lineEnd(text, pos) + 1;

    if (ls >= text.length) {
        return pos;
    }

    return ls + countSpaces(text, ls);
}

function moveToVeryBeginning() {
    return 0;
}

function moveToVeryEnd(text: string) {
    return text.length;
}

function moveToFirstWordStart(text: string, pos: number) {
    let ls = lineStart(text, pos);
    while (text.charAt(ls++) === " ") {
        ;
    }
    return ls - 1;
}

function moveToNextWord(text: string, pos: number) {
    const end = selectWord(text, pos)[END];
    return end + countSpaces(text, end);
}

function moveToNextWordPlus(text: string, pos: number) {
    const end = selectWordPlus(text, pos)[END];
    return end + countSpaces(text, end);
}

function moveToEndWord(text: string, pos: number) {
    return selectWord(
        text,
        pos + countSpaces(text, pos),
    )[END];
}

function moveToEndWordPlus(text: string, pos: number) {
    return selectWordPlus(
        text,
        pos + countSpaces(text, pos),
    )[END];
}

function moveToPreviousWord(text: string, pos: number) {
    return selectWord(
        text,
        pos - countSpaces(text, pos) - 1,
    )[START];
}

function moveToPreviousWordPlus(text: string, pos: number) {
    return selectWordPlus(
        text,
        pos - countSpaces(text, pos) - 1,
    )[START];
}

/*
 
actions
 
*/

function actionEnterIndend(vim: Vim) {
    const text = getText(vim);
    const caret = getCaret(vim);

    const ls = lineStart(text, caret);

    const spacing = "\n" + " ".repeat(
        Math.min(caret - ls, countSpaces(text, ls))
    );

    setText(vim, insertAt(text, caret, spacing));
    setCaret(vim, caret + spacing.length);
}

function actionDigit(vim: Vim, data: VimNodeData) {
    vim.digitbuf += data.digit;
}

function actionZero(vim: Vim, data: VimNodeData) {
    if (vim.digitbuf.length) {
        actionDigit(vim, data);
    }
    else {
        setCaret(
            vim,
            lineStart(getText(vim), getCaret(vim))
        );
    }
}

function actionMove(vim: Vim, data: VimNodeData) {
    if (data.move) {
        setCaret(vim, data.move(getText(vim), getCaret(vim)));
    }
}

function actionAppend(vim: Vim) {
    const caret = getCaret(vim);
    setCaret(vim, Math.min(caret + 1, lineEnd(getText(vim), caret)));
    setMode(vim, Mode.INSERT);
}

function actionAppendToEnd(vim: Vim) {
    setCaret(vim, lineEnd(getText(vim), getCaret(vim)));
    setMode(vim, Mode.INSERT);
}

function actionInsert(vim: Vim) {
    setMode(vim, Mode.INSERT);
}

function actionVisualMode(vim: Vim) {
    setMode(vim, Mode.VISUAL);
}

function actionUndo(vim: Vim) {
    const undo = vim.undostack.pop();

    if (undo) {
        setText(vim, undo.text);
        setCaret(vim, undo.caret);
    }
}

function actionDeleteRange(vim: Vim, data: VimNodeData) {
    const [start, end] = getSelection(vim, data);
    yank(vim, start, end, true);
    setMode(vim, data.mode || Mode.COMMAND);
}

function actionDeleteChar(vim: Vim, data: VimNodeData) {
    const caret = getCaret(vim);
    const text = getText(vim);

    if (text.charAt(caret) !== "\n") {
        yank(vim, caret, caret + 1, true);
    }
    else if (text.charAt(caret - 1) !== "\n") {
        yank(vim, caret - 1, caret, true);
    }

    setMode(vim, data.mode || Mode.COMMAND);
}

function actionDeleteCurrentSelection(vim: Vim, data: VimNodeData) {
    const caret = getCaret(vim);
    yank(
        vim,
        Math.min(vim.selectionStart || 0, caret),
        Math.max(vim.selectionStart || 0, caret),
        true
    );
    setMode(vim, data.mode || Mode.COMMAND);
}

function actionYankRange(vim: Vim, data: VimNodeData) {
    const [start, end] = getSelection(vim, data);
    yank(vim, start, end, false);
}

function actionPasteAfter(vim: Vim) {
    const caret = getCaret(vim);
    setText(vim, insertAt(getText(vim), caret + 1, vim.clipboard));
    setCaret(vim, caret + vim.clipboard.length);
}

function actionPasteBefore(vim: Vim) {
    const caret = getCaret(vim);
    setText(vim, insertAt(getText(vim), caret, vim.clipboard));
    setCaret(vim, caret);
}

function actionMergeLines(vim: Vim) {
    const text = getText(vim);
    const le = lineEnd(text, getCaret(vim));

    setText(vim, text.slice(0, le) + text.slice(le + 1));
    setCaret(vim, le);
}

function actionInsertLineAfter(vim: Vim) {
    const text = getText(vim);
    const caret = getCaret(vim);

    const spacing = "\n" + " ".repeat(
        countSpaces(text, lineStart(text, caret))
    );

    const le = lineEnd(text, caret);

    setText(vim, insertAt(text, le, spacing));
    setCaret(vim, le + spacing.length);

    setMode(vim, Mode.INSERT);
}

function actionInsertLineBefore(vim: Vim) {
    const text = getText(vim);
    const ls = lineStart(text, getCaret(vim));

    const spacing = " ".repeat(
        countSpaces(text, ls)
    ) + "\n";

    setText(vim, insertAt(text, ls, spacing));
    setCaret(vim, ls + spacing.length - 1);

    setMode(vim, Mode.INSERT);
}

function actionIncreaseIndent(vim: Vim, data: VimNodeData) {
    actionAlterLineStart(vim, data, increaseIndent);
}

function actionDecreaseIndent(vim: Vim, data: VimNodeData) {
    actionAlterLineStart(vim, data, decreaseIndent);
}

function actionAlterLineStart(vim: Vim, data: VimNodeData, f: (str: string) => string) {
    const text = getText(vim);

    const [start, end] = getSelection(vim, data);
    const ls = lineStart(text, start);

    setText(
        vim,
        text.slice(0, ls) + f(text.slice(ls, end)) + text.slice(end)
    );

    // FIX: Caret position
    setCaret(vim, ls + countSpaces(text, ls));
}
