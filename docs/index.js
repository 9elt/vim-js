// ../vim.ts
var TAB_WIDTH = 4;
var PAGE_SIZE = 16;
var REPEAT_LIMIT = 128;
var UNDO_LIMIT = 1024;
class VimNode {
  data;
  nodes;
  constructor(data = {}, nodes = {}) {
    this.data = data;
    this.nodes = nodes;
  }
}
function isLeaf(vnode) {
  for (const _ in vnode.nodes) {
    return false;
  }
  return true;
}
var digits = {
  "0": new VimNode({ action: actionDigit, digit: "0" }),
  "1": new VimNode({ action: actionDigit, digit: "1" }),
  "2": new VimNode({ action: actionDigit, digit: "2" }),
  "3": new VimNode({ action: actionDigit, digit: "3" }),
  "4": new VimNode({ action: actionDigit, digit: "4" }),
  "5": new VimNode({ action: actionDigit, digit: "5" }),
  "6": new VimNode({ action: actionDigit, digit: "6" }),
  "7": new VimNode({ action: actionDigit, digit: "7" }),
  "8": new VimNode({ action: actionDigit, digit: "8" }),
  "9": new VimNode({ action: actionDigit, digit: "9" })
};
var navigation = (data) => ({
  "0": new VimNode({ ...data, move: lineStart }),
  _: new VimNode({ ...data, move: moveToFirstWordStart }),
  $: new VimNode({ ...data, move: lineEnd }),
  ArrowLeft: new VimNode({ ...data, move: moveLeft }),
  ArrowDown: new VimNode({ ...data, move: moveDown }),
  ArrowUp: new VimNode({ ...data, move: moveUp }),
  ArrowRight: new VimNode({ ...data, move: moveRight }),
  h: new VimNode({ ...data, move: moveLeft }),
  j: new VimNode({ ...data, move: moveDown }),
  k: new VimNode({ ...data, move: moveUp }),
  l: new VimNode({ ...data, move: moveRight }),
  Enter: new VimNode({ ...data, move: moveToWordNextLine }),
  Backspace: new VimNode({ ...data, move: moveLeft }),
  w: new VimNode({ ...data, move: moveToNextWord }),
  W: new VimNode({ ...data, move: moveToNextWordPlus }),
  e: new VimNode({ ...data, move: moveToEndWord }),
  E: new VimNode({ ...data, move: moveToEndWordPlus }),
  b: new VimNode({ ...data, move: moveToPreviousWord }),
  B: new VimNode({ ...data, move: moveToPreviousWordPlus }),
  g: new VimNode({}, {
    g: new VimNode({ ...data, move: moveToVeryBeginning })
  }),
  G: new VimNode({ ...data, move: moveToVeryEnd }),
  "C-b": new VimNode({ ...data, move: movePageUp }),
  "C-f": new VimNode({ ...data, move: movePageDown }),
  "C-u": new VimNode({ ...data, move: moveHalfPageUp }),
  "C-d": new VimNode({ ...data, move: moveHalfPageDown }),
  f: new VimNode({ ...data, move: moveToChar, readNextChar: true, offsetSelectionEnd: 1 }),
  t: new VimNode({ ...data, move: moveBeforeChar, readNextChar: true, offsetSelectionEnd: 1 })
});
var selectors = (data) => ({
  a: new VimNode(data, {
    p: new VimNode({ select: selectParagraphWithSpacesAfter }),
    w: new VimNode({ select: selectWordWithSpacesAfter }),
    W: new VimNode({ select: selectWordPlusWithSpacesAfter }),
    "'": new VimNode({ select: selectSingleQuotes }),
    '"': new VimNode({ select: selectDoubleQuotes }),
    "`": new VimNode({ select: selectBacktick }),
    "(": new VimNode({ select: selectBrackets }),
    ")": new VimNode({ select: selectBrackets }),
    "[": new VimNode({ select: selectSquares }),
    "]": new VimNode({ select: selectSquares }),
    "{": new VimNode({ select: selectBraces }),
    "}": new VimNode({ select: selectBraces }),
    "<": new VimNode({ select: selectAngles }),
    ">": new VimNode({ select: selectAngles })
  }),
  i: new VimNode(data, {
    p: new VimNode({ select: selectParagraph }),
    w: new VimNode({ select: selectWord }),
    W: new VimNode({ select: selectWordPlus }),
    "'": new VimNode({ select: inside(selectSingleQuotes) }),
    '"': new VimNode({ select: inside(selectDoubleQuotes) }),
    "`": new VimNode({ select: inside(selectBacktick) }),
    "(": new VimNode({ select: inside(selectBrackets) }),
    ")": new VimNode({ select: inside(selectBrackets) }),
    "[": new VimNode({ select: inside(selectSquares) }),
    "]": new VimNode({ select: inside(selectSquares) }),
    "{": new VimNode({ select: inside(selectBraces) }),
    "}": new VimNode({ select: inside(selectBraces) }),
    "<": new VimNode({ select: inside(selectAngles) }),
    ">": new VimNode({ select: inside(selectAngles) })
  })
});
var baseSelectors = selectors();
var visualSelectors = selectors({ action: actionSetVisualSelection });
var baseNavigation = navigation();
var moveNavigation = navigation({ action: actionMove });
var commandTree = new VimNode({}, {
  ...moveNavigation,
  ...digits,
  a: new VimNode({ action: actionAppend, mode: 1 /* INSERT */ }),
  A: new VimNode({ action: actionAppendToEnd, mode: 1 /* INSERT */ }),
  c: new VimNode({ action: actionDeleteRange, mode: 1 /* INSERT */ }, {
    ...baseNavigation,
    ...baseSelectors,
    c: new VimNode({ select: selectLine }),
    w: new VimNode({ select: selectToWordBound }),
    W: new VimNode({ select: selectToWordBoundPlus })
  }),
  C: new VimNode({ action: actionDeleteRange, move: lineEnd, mode: 1 /* INSERT */ }),
  d: new VimNode({ action: actionDeleteRange, mode: 0 /* COMMAND */ }, {
    ...baseNavigation,
    ...baseSelectors,
    d: new VimNode({ select: selectLineNL }),
    w: new VimNode({ select: selectToNextWord }),
    W: new VimNode({ select: selectToNextWordPlus })
  }),
  D: new VimNode({ action: actionDeleteRange, move: lineEnd, mode: 0 /* COMMAND */ }),
  i: new VimNode({ action: actionSetMode, mode: 1 /* INSERT */ }),
  J: new VimNode({ action: actionMergeLines }),
  o: new VimNode({ action: actionInsertLineAfter, mode: 1 /* INSERT */ }),
  O: new VimNode({ action: actionInsertLineBefore, mode: 1 /* INSERT */ }),
  p: new VimNode({ action: actionPasteAfter }),
  P: new VimNode({ action: actionPasteBefore }),
  s: new VimNode({ action: actionDeleteChar, mode: 1 /* INSERT */ }),
  u: new VimNode({ action: actionUndo, dontSaveUndoState: true }),
  "C-r": new VimNode({ action: actionRedo, dontSaveUndoState: true }),
  v: new VimNode({ action: actionSetMode, mode: 2 /* VISUAL */ }),
  x: new VimNode({ action: actionDeleteChar }),
  r: new VimNode({ action: actionReplaceChar, readNextChar: true }),
  y: new VimNode({ action: actionYankRange }, {
    ...baseNavigation,
    ...baseSelectors,
    y: new VimNode({ select: selectLineNL }),
    w: new VimNode({ select: selectToNextWord }),
    W: new VimNode({ select: selectToNextWordPlus })
  }),
  ">": new VimNode({ action: actionIncreaseIndent }, {
    ...baseNavigation,
    ...baseSelectors,
    ">": new VimNode({ select: selectLine })
  }),
  "<": new VimNode({ action: actionDecreaseIndent }, {
    ...baseNavigation,
    ...baseSelectors,
    "<": new VimNode({ select: selectLine })
  }),
  ".": new VimNode({ action: actionRepeatLastAction })
});
var visualTree = new VimNode({ action: actionMove }, {
  ...moveNavigation,
  ...visualSelectors,
  ...digits,
  d: new VimNode({ action: actionDeleteVisualSelection, mode: 0 /* COMMAND */ }),
  c: new VimNode({ action: actionDeleteVisualSelection, mode: 1 /* INSERT */ }),
  y: new VimNode({ action: actionYankVisualSelection, mode: 0 /* COMMAND */ }),
  p: new VimNode({ action: actionPasteIntoVisualSelection, mode: 0 /* COMMAND */ })
});
var RESERVED_KEYS = ["Shift", "CapsLock", "Control", "Meta", "Alt", "AltGraph"];

class Vim {
  textarea;
  mode = 0 /* COMMAND */;
  node = commandTree;
  data = {};
  cmdseq = "";
  keyseq = [];
  modseq = [];
  digits = "";
  clipboard = "";
  redo = [];
  undo = [];
  allowClipboardReset = false;
  selectionStart = null;
  constructor(textarea) {
    this.textarea = textarea;
    textarea.addEventListener("keydown", (event) => {
      if (!RESERVED_KEYS.includes(event.key)) {
        const key = event.ctrlKey ? "C-" + event.key : event.key;
        if (onKey(this, key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    });
  }
}
function onKey(vim, key) {
  vim.keyseq.push(key);
  if (key === "Escape" || key === "C-c" || key === "C-s") {
    if (vim.keyseq.length > 1 && vim.mode === 1 /* INSERT */) {
      vim.modseq = vim.keyseq;
    }
    vim.keyseq = [];
    setMode(vim, 0 /* COMMAND */);
    resetCommand(vim);
    return true;
  }
  if (vim.mode === 1 /* INSERT */) {
    if (key === "Enter") {
      actionEnterIndend(vim);
      return true;
    }
    if (key === "Tab") {
      actionTab(vim);
      return true;
    }
    return false;
  }
  console.log(vim.cmdseq + key);
  if (vim.data.readNextChar) {
    vim.data.nextChar = key;
    exec(vim);
    return true;
  }
  const node = vim.node.nodes[key];
  if (!node) {
    resetCommand(vim);
    return false;
  }
  vim.cmdseq += key;
  vim.node = node;
  vim.data = { ...vim.data, ...node.data };
  if (!vim.data.readNextChar && isLeaf(node)) {
    exec(vim);
  }
  return true;
}
function exec(vim) {
  const repeat = vim.data.digit ? 1 : Math.max(0, Math.min(parseInt(vim.digits || "1"), REPEAT_LIMIT));
  if (!vim.data.digit && vim.digits) {
    vim.digits = "";
  }
  vim.allowClipboardReset = true;
  const prevHistoryState = toHistoryState(vim);
  for (var i = 0;i < repeat; i++) {
    vim.data.action(vim, vim.data);
  }
  if (vim.data.mode !== undefined) {
    setMode(vim, vim.data.mode);
  }
  if (!vim.data.dontSaveUndoState) {
    saveUndoState(vim, prevHistoryState);
  }
  resetCommand(vim);
}
function getText(vim) {
  return vim.textarea.value;
}
function setText(vim, text) {
  vim.textarea.value = text;
}
function getCaret(vim) {
  if (vim.mode === 2 /* VISUAL */) {
    return vim.textarea.selectionEnd === vim.selectionStart ? vim.textarea.selectionStart : vim.textarea.selectionEnd;
  } else {
    return vim.textarea.selectionEnd;
  }
}
function setCaret(vim, caret) {
  if (vim.mode === 2 /* VISUAL */) {
    vim.textarea.setSelectionRange(Math.min(caret, vim.selectionStart), Math.max(caret, vim.selectionStart));
  } else {
    vim.textarea.setSelectionRange(caret, caret);
  }
}
function toHistoryState(vim) {
  return {
    text: getText(vim),
    caret: getCaret(vim)
  };
}
function setMode(vim, mode) {
  if (vim.mode === mode) {
    return;
  }
  if (mode === 2 /* VISUAL */) {
    vim.selectionStart = getCaret(vim);
  } else if (vim.mode === 2 /* VISUAL */) {
    const caret = getCaret(vim);
    vim.selectionStart = null;
    vim.textarea.setSelectionRange(caret, caret);
  }
  vim.mode = mode;
}
function resetCommand(vim) {
  if (vim.data.mode !== 1 /* INSERT */ && vim.data.mode !== 2 /* VISUAL */) {
    vim.keyseq = [];
  }
  vim.node = vim.mode === 2 /* VISUAL */ ? visualTree : commandTree;
  vim.data = {};
  vim.cmdseq = "";
}
function saveUndoState(vim, prevHistory) {
  const currText = getText(vim);
  if (prevHistory.text !== currText) {
    if (vim.keyseq.length) {
      vim.modseq = vim.keyseq;
    }
    vim.redo.length = 0;
    vim.undo.push(prevHistory);
    if (vim.undo.length > UNDO_LIMIT) {
      vim.undo.shift();
    }
  }
}
function clipboard(vim, text) {
  if (text) {
    if (vim.allowClipboardReset) {
      vim.allowClipboardReset = false;
      vim.clipboard = "";
    }
    vim.clipboard += text;
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(vim.clipboard).catch(console.error);
    }
  }
}
function getSelection(vim, data) {
  const text = getText(vim);
  const caret = getCaret(vim);
  if (data.select) {
    return data.select(text, caret, vim);
  }
  if (data.move) {
    const mov = data.move(text, caret, vim) + (data.offsetSelectionEnd || 0);
    return mov > caret ? [caret, mov] : [mov, caret];
  }
  return [0, 0];
}
function getVisualSelection(vim) {
  return [
    Math.min(vim.selectionStart || 0, getCaret(vim)),
    Math.max(vim.selectionStart || 0, getCaret(vim))
  ];
}
function yank(vim, start, end, cut) {
  const text = getText(vim);
  clipboard(vim, text.slice(start, end));
  const result = text.slice(0, start) + text.slice(end);
  if (cut) {
    setText(vim, result);
  }
  setCaret(vim, start);
  return result;
}
function insertAt(text, pos, data) {
  return text.slice(0, pos) + data + text.slice(pos);
}
function countSpaces(text, pos, allow = " ") {
  let i = 0;
  let c;
  while ((c = text.charAt(pos + i)) && allow.includes(c)) {
    i++;
  }
  return i;
}
function lineStart(text, pos) {
  const i = text.lastIndexOf(`
`, text.charAt(pos) === `
` ? pos - 1 : pos);
  return i === -1 ? 0 : i + 1;
}
function lineEnd(text, pos) {
  const i = text.indexOf(`
`, pos);
  return i === -1 ? text.length : i;
}
function isLineEnd(text, pos) {
  return text.charAt(pos) === `
` || pos === text.length;
}
function increaseIndent(str) {
  return str = " ".repeat(TAB_WIDTH) + str;
}
function decreaseIndent(str) {
  for (let i = 0;i < TAB_WIDTH; i++) {
    if (str.startsWith(" ")) {
      str = str.slice(1);
    }
  }
  return str;
}
function findRegexBreak(text, pos, regex) {
  let l = 0;
  let r;
  let match;
  while (match = regex.exec(text)) {
    let i = match.index + 1;
    if (i <= pos) {
      l = i;
    } else if (r === undefined) {
      r = i;
    }
  }
  return [l, r === undefined ? text.length : r];
}
var START = 0;
var END = 1;
function inside(f) {
  return (text, pos, vim) => {
    const range = f(text, pos, vim);
    return range[END] === range[START] ? range : [range[START] + 1, range[END] - 1];
  };
}
function selectLine(text, pos) {
  return [lineStart(text, pos), lineEnd(text, pos)];
}
function selectLineNL(text, pos) {
  return [lineStart(text, pos), lineEnd(text, pos) + 1];
}
var FIND_WORD = /(\\s(?=\\S))|([^\u0000-/:-@[-`{-¿](?=[\u0000-/:-@[-`{-¿]))|(\\S(?=\\s))|([\u0000-/:-@[-`{-¿](?=[^\u0000-/:-@[-`{-¿]))/g;
function selectWord(text, pos) {
  return findRegexBreak(text, pos, FIND_WORD);
}
var FIND_WORD_PLUS = /(\s(?=\S))|(\S(?=\s))/g;
function selectWordPlus(text, pos) {
  return findRegexBreak(text, pos, FIND_WORD_PLUS);
}
var FIND_PARAGRAPH = /\n\s*\n/g;
function selectParagraph(text, pos) {
  return findRegexBreak(text, pos, FIND_PARAGRAPH);
}
function selectToNextWord(text, pos) {
  return [pos, moveToNextWord(text, pos)];
}
function selectToNextWordPlus(text, pos) {
  return [pos, moveToNextWordPlus(text, pos)];
}
function selectToWordBound(text, pos) {
  return [pos, selectWord(text, pos)[END]];
}
function selectToWordBoundPlus(text, pos) {
  return [pos, selectWordPlus(text, pos)[END]];
}
function selectWordWithSpacesAfter(text, pos) {
  const [start, end] = selectWord(text, pos);
  return [start, end + countSpaces(text, end)];
}
function selectWordPlusWithSpacesAfter(text, pos) {
  const [start, end] = selectWordPlus(text, pos);
  return [start, end + countSpaces(text, end)];
}
function selectParagraphWithSpacesAfter(text, pos) {
  const [start, end] = selectParagraph(text, pos);
  return [start, end + countSpaces(text, end)];
}
function selectSingleQuotes(text, pos) {
  return selectQuotes(text, pos, "'");
}
function selectDoubleQuotes(text, pos) {
  return selectQuotes(text, pos, '"');
}
function selectBacktick(text, pos) {
  return selectQuotes(text, pos, "`");
}
function selectQuotes(text, pos, quote) {
  let l;
  let r;
  for (let i = pos;i >= 0; i--) {
    if (text.charAt(i) === quote) {
      l = i;
      break;
    }
  }
  for (let i = pos + 1;i < text.length; i++) {
    if (text.charAt(i) === quote) {
      r = i;
      break;
    }
  }
  return [l || 0, (r || text.length) + 1];
}
function selectBrackets(text, pos) {
  return selectBounds(text, pos, "()");
}
function selectBraces(text, pos) {
  return selectBounds(text, pos, "{}");
}
function selectSquares(text, pos) {
  return selectBounds(text, pos, "[]");
}
function selectAngles(text, pos) {
  return selectBounds(text, pos, "<>");
}
function selectBounds(text, pos, bounds) {
  const start = bounds.charAt(START);
  const end = bounds.charAt(END);
  let l;
  let r;
  if (text.charAt(pos) === start) {
    l = pos;
  } else {
    let k = 1;
    for (let i = pos - 1;i >= 0; i--) {
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
  } else {
    let k = 1;
    for (let i = pos + 1;i < text.length; i++) {
      const char = text.charAt(i);
      k += (char === start ? 1 : 0) + (char === end ? -1 : 0);
      if (k === 0) {
        r = i;
        break;
      }
    }
  }
  return r === undefined || l === undefined ? [pos, 0] : [l, r + 1];
}
function moveLeft(_, pos) {
  return Math.max(0, pos - 1);
}
function moveRight(text, pos) {
  return Math.min(text.length, pos + 1);
}
function moveDown(text, pos) {
  const ls = lineStart(text, pos);
  const le = lineEnd(text, pos);
  if (le === text.length) {
    return pos;
  }
  const nls = le + 1;
  const nle = lineEnd(text, nls);
  return nls + Math.min(pos - ls, nle - nls);
}
function moveUp(text, pos) {
  const ls = lineStart(text, pos);
  if (ls === 0) {
    return pos;
  }
  const ple = ls - 1;
  const pls = lineStart(text, ple);
  return pls + Math.min(pos - ls, ple - pls);
}
function moveHalfPageUp(text, pos) {
  for (let i = 0;i < PAGE_SIZE; i++) {
    pos = moveUp(text, pos);
  }
  return pos;
}
function moveHalfPageDown(text, pos) {
  for (let i = 0;i < PAGE_SIZE; i++) {
    pos = moveDown(text, pos);
  }
  return pos;
}
function movePageDown(text, pos) {
  pos = moveHalfPageDown(text, pos);
  pos = moveHalfPageDown(text, pos);
  return pos;
}
function movePageUp(text, pos) {
  pos = moveHalfPageUp(text, pos);
  pos = moveHalfPageUp(text, pos);
  return pos;
}
function moveToWordNextLine(text, pos) {
  const ls = lineEnd(text, pos) + 1;
  if (ls >= text.length) {
    return pos;
  }
  return ls + countSpaces(text, ls);
}
function moveToVeryBeginning() {
  return 0;
}
function moveToVeryEnd(text) {
  return text.length;
}
function moveToFirstWordStart(text, pos) {
  let ls = lineStart(text, pos);
  while (text.charAt(ls++) === " ") {
  }
  return ls - 1;
}
function moveToNextWord(text, pos) {
  const end = selectWord(text, pos)[END];
  return end + countSpaces(text, end);
}
function moveToNextWordPlus(text, pos) {
  const end = selectWordPlus(text, pos)[END];
  return end + countSpaces(text, end);
}
function moveToEndWord(text, pos) {
  return selectWord(text, pos + countSpaces(text, pos))[END];
}
function moveToEndWordPlus(text, pos) {
  return selectWordPlus(text, pos + countSpaces(text, pos))[END];
}
function moveToPreviousWord(text, pos) {
  return selectWord(text, pos - countSpaces(text, pos) - 1)[START];
}
function moveToPreviousWordPlus(text, pos) {
  return selectWordPlus(text, pos - countSpaces(text, pos) - 1)[START];
}
function moveToChar(text, pos, vim) {
  const end = text.indexOf(vim.data.nextChar, pos + 1);
  return end === -1 ? pos : end;
}
function moveBeforeChar(text, pos, vim) {
  const end = text.indexOf(vim.data.nextChar, pos + 1);
  return end === -1 ? pos : end - 1;
}
function actionEnterIndend(vim) {
  const text = getText(vim);
  const caret = getCaret(vim);
  const ls = lineStart(text, caret);
  const spacing = `
` + " ".repeat(Math.min(caret - ls, countSpaces(text, ls)));
  setText(vim, insertAt(text, caret, spacing));
  setCaret(vim, caret + spacing.length);
}
function actionTab(vim) {
  const text = getText(vim);
  const caret = getCaret(vim);
  const ls = lineStart(text, caret);
  const spacing = " ".repeat(TAB_WIDTH - (caret - ls) % TAB_WIDTH);
  setText(vim, insertAt(text, caret, spacing));
  setCaret(vim, caret + spacing.length);
}
function actionDigit(vim, data) {
  if (!vim.digits && data.digit === "0") {
    setCaret(vim, lineStart(getText(vim), getCaret(vim)));
  } else {
    vim.digits += data.digit;
  }
}
function actionMove(vim, data) {
  setCaret(vim, data.move(getText(vim), getCaret(vim), vim));
}
function actionAppend(vim) {
  const caret = getCaret(vim);
  setCaret(vim, Math.min(caret + 1, lineEnd(getText(vim), caret)));
}
function actionAppendToEnd(vim) {
  setCaret(vim, lineEnd(getText(vim), getCaret(vim)));
}
function actionSetMode() {
}
function actionUndo(vim) {
  const undo = vim.undo.pop();
  if (undo) {
    vim.redo.push({
      text: getText(vim),
      caret: undo.caret
    });
    setText(vim, undo.text);
    setCaret(vim, undo.caret);
  }
}
function actionRedo(vim) {
  const redo = vim.redo.pop();
  if (redo) {
    vim.undo.push({
      text: getText(vim),
      caret: redo.caret
    });
    setText(vim, redo.text);
    setCaret(vim, redo.caret);
  }
}
function actionDeleteRange(vim, data) {
  const [start, end] = getSelection(vim, data);
  yank(vim, start, end, true);
}
function actionDeleteChar(vim) {
  const text = getText(vim);
  const _caret = getCaret(vim);
  const caret = isLineEnd(text, _caret) ? _caret - 1 : _caret;
  if (!isLineEnd(text, caret)) {
    yank(vim, caret, caret + 1, true);
  }
}
function actionReplaceChar(vim, data) {
  const text = getText(vim);
  const _caret = getCaret(vim);
  const caret = isLineEnd(text, _caret) ? _caret - 1 : _caret;
  if (!isLineEnd(text, caret)) {
    setText(vim, text.slice(0, caret) + data.nextChar + text.slice(caret + 1));
    setCaret(vim, caret);
  }
  setMode(vim, data.mode || 0 /* COMMAND */);
}
function actionSetVisualSelection(vim) {
  const [start, end] = getSelection(vim, vim.data);
  vim.selectionStart = start;
  setCaret(vim, end);
}
function actionDeleteVisualSelection(vim) {
  yank(vim, ...getVisualSelection(vim), true);
}
function actionYankVisualSelection(vim) {
  yank(vim, ...getVisualSelection(vim), false);
}
function actionPasteIntoVisualSelection(vim) {
  const [start, end] = getVisualSelection(vim);
  const text = getText(vim);
  setText(vim, text.slice(0, start) + vim.clipboard + text.slice(end));
  setCaret(vim, start + vim.clipboard.length);
}
function actionYankRange(vim, data) {
  const [start, end] = getSelection(vim, data);
  yank(vim, start, end, false);
}
function actionPasteAfter(vim) {
  const caret = getCaret(vim);
  setText(vim, insertAt(getText(vim), caret + 1, vim.clipboard));
  setCaret(vim, caret + vim.clipboard.length);
}
function actionPasteBefore(vim) {
  const caret = getCaret(vim);
  setText(vim, insertAt(getText(vim), caret, vim.clipboard));
  setCaret(vim, caret);
}
function actionMergeLines(vim) {
  const text = getText(vim);
  const le = lineEnd(text, getCaret(vim));
  setText(vim, text.slice(0, le) + text.slice(le + 1));
  setCaret(vim, le);
}
function actionInsertLineAfter(vim) {
  const text = getText(vim);
  const caret = getCaret(vim);
  const spacing = `
` + " ".repeat(countSpaces(text, lineStart(text, caret)));
  const le = lineEnd(text, caret);
  setText(vim, insertAt(text, le, spacing));
  setCaret(vim, le + spacing.length);
}
function actionInsertLineBefore(vim) {
  const text = getText(vim);
  const ls = lineStart(text, getCaret(vim));
  const spacing = " ".repeat(countSpaces(text, ls)) + `
`;
  setText(vim, insertAt(text, ls, spacing));
  setCaret(vim, ls + spacing.length - 1);
}
function actionIncreaseIndent(vim, data) {
  actionAlterLineStart(vim, data, increaseIndent);
}
function actionDecreaseIndent(vim, data) {
  actionAlterLineStart(vim, data, decreaseIndent);
}
function actionAlterLineStart(vim, data, f) {
  const text = getText(vim);
  const caret = getCaret(vim);
  const [start, end] = getSelection(vim, data);
  const ls = lineStart(text, start);
  setText(vim, text.slice(0, ls) + f(text.slice(ls, end)) + text.slice(end));
  setCaret(vim, caret);
}
function actionRepeatLastAction(vim) {
  resetCommand(vim);
  for (const key of vim.modseq) {
    const accepted = onKey(vim, key);
    if (!accepted && vim.mode === 1 /* INSERT */ && key.length === 1) {
      const text = getText(vim);
      const caret = getCaret(vim);
      setText(vim, insertAt(text, caret, key));
      setCaret(vim, caret + 1);
    }
  }
}

// index.ts
new Vim(document.querySelector("textarea"));
