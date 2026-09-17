import { writable, get } from 'svelte/store';
import { logOpBM, bracketMatchingLog } from '../shared/bracketMatchingLog.js';
import { pushHistory } from '../shared/history.js';
import { toast } from '../shared/toast.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: validating balanced brackets with a single stack. Every
 * opening bracket is pushed; every closing bracket must match whatever is
 * on top of the stack, or the expression is unbalanced. If anything is
 * still on the stack once the input runs out, some bracket was never closed.
 *
 * @typedef {{ kind: 'push'|'pop'|'skip'|'error'|'balanced'|'unbalanced-end', char?: string, index?: number, opened?: string, reason?: string, leftover?: string[] }} BracketStep
 * @typedef {{ id: string, char: string }} BracketFrame
 */

const OPEN_TO_CLOSE = { '(': ')', '[': ']', '{': '}' };
const OPENERS = new Set(Object.keys(OPEN_TO_CLOSE));
const CLOSERS = new Set(Object.values(OPEN_TO_CLOSE));

const BRACKET_METHOD = {
    java: `boolean isBalanced(String s) {\n    Deque<Character> stack = new ArrayDeque<>();\n    Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');\n    for (char c : s.toCharArray()) {\n        if (c == '(' || c == '[' || c == '{') {\n            stack.push(c);\n        } else if (pairs.containsKey(c)) {\n            if (stack.isEmpty() || stack.pop() != pairs.get(c)) return false;\n        }\n    }\n    return stack.isEmpty();\n}`,
    python: `def is_balanced(s):\n    stack = []\n    pairs = {')': '(', ']': '[', '}': '{'}\n    for c in s:\n        if c in '([{':\n            stack.append(c)\n        elif c in pairs:\n            if not stack or stack.pop() != pairs[c]:\n                return False\n    return not stack`,
    cpp: `bool isBalanced(const std::string& s) {\n    std::stack<char> st;\n    std::unordered_map<char, char> pairs = {{')', '('}, {']', '['}, {'}', '{'}};\n    for (char c : s) {\n        if (c == '(' || c == '[' || c == '{') {\n            st.push(c);\n        } else if (pairs.count(c)) {\n            if (st.empty() || st.top() != pairs[c]) return false;\n            st.pop();\n        }\n    }\n    return st.empty();\n}`,
};

/**
 * @typedef {{
 *   input: string,
 *   steps: BracketStep[],
 *   stepIndex: number,
 *   stack: BracketFrame[],
 *   playing: boolean,
 *   speed: number,
 *   done: boolean,
 *   result: 'balanced'|'unbalanced'|null,
 *   errorMsg: string|null,
 * }} BracketState
 */

/** @type {import('svelte/store').Writable<BracketState>} */
export const bracketState = writable({
    input: '',
    steps: [],
    stepIndex: -1,
    stack: [],
    playing: false,
    speed: 700,
    done: false,
    result: null,
    errorMsg: null,
});

/** @type {ReturnType<typeof setInterval>|null} */
let intervalId = null;

/** True between runCheck() and the matching pushHistory() that closes the bracket. */
let sessionActive = false;

let frameCounter = 0;

/**
 * @param {string} input
 * @returns {{ steps: BracketStep[], result: 'balanced'|'unbalanced' }}
 */
function computeSteps(input) {
    /** @type {BracketStep[]} */
    const steps = [];
    /** @type {string[]} */
    const scratch = [];

    for (let index = 0; index < input.length; index++) {
        const char = input[index];
        if (OPENERS.has(char)) {
            scratch.push(char);
            steps.push({ kind: 'push', char, index });
        } else if (CLOSERS.has(char)) {
            if (scratch.length === 0) {
                steps.push({
                    kind: 'error',
                    char,
                    index,
                    reason: `"${char}" has no matching open bracket`,
                });
                return { steps, result: 'unbalanced' };
            }
            const top = scratch[scratch.length - 1];
            if (OPEN_TO_CLOSE[top] === char) {
                scratch.pop();
                steps.push({ kind: 'pop', char, index, opened: top });
            } else {
                steps.push({
                    kind: 'error',
                    char,
                    index,
                    reason: `expected "${OPEN_TO_CLOSE[top]}" to close "${top}", found "${char}"`,
                });
                return { steps, result: 'unbalanced' };
            }
        } else if (/\s/.test(char)) {
            // Whitespace carries no algorithmic weight, so it doesn't get a
            // step — otherwise every space would cost a playback tick and
            // padded expressions would crawl.
            continue;
        } else {
            steps.push({ kind: 'skip', char, index });
        }
    }

    if (scratch.length > 0) {
        steps.push({ kind: 'unbalanced-end', leftover: [...scratch] });
        return { steps, result: 'unbalanced' };
    }
    steps.push({ kind: 'balanced' });
    return { steps, result: 'balanced' };
}

function stopInterval() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function closeSession() {
    stopInterval();
    if (sessionActive) {
        pushHistory();
        sessionActive = false;
    }
}

/** @param {string} rawInput */
export function runCheck(rawInput) {
    stopInterval();

    if (!rawInput) {
        toast.error('Enter an expression first');
        return;
    }

    const { steps, result } = computeSteps(rawInput);

    if (!sessionActive) {
        pushHistory();
        sessionActive = true;
    }

    logOpBM(BRACKET_METHOD.java, BRACKET_METHOD.python, BRACKET_METHOD.cpp);
    logOpBM(
        `// isBalanced("${rawInput}")`,
        `# is_balanced("${rawInput}")`,
        `// isBalanced("${rawInput}")`,
    );

    bracketState.set({
        input: rawInput,
        steps,
        stepIndex: -1,
        stack: [],
        playing: false,
        speed: get(bracketState).speed,
        done: false,
        result,
        errorMsg: null,
    });
}

export function stepForward() {
    const state = get(bracketState);
    if (state.stepIndex >= state.steps.length - 1) {
        stopInterval();
        bracketState.update((s) => ({ ...s, playing: false }));
        return;
    }

    const nextIndex = state.stepIndex + 1;
    const step = state.steps[nextIndex];
    let stack = state.stack;
    let errorMsg = state.errorMsg;

    if (step.kind === 'push') {
        logOpBM(
            `push('${step.char}') // stack.push('${step.char}')`,
            `stack.append('${step.char}')`,
            `st.push('${step.char}');`,
        );
        stack = [...stack, { id: `bf_${++frameCounter}`, char: step.char }];
    } else if (step.kind === 'pop') {
        logOpBM(
            `pop() -> '${step.opened}' matches '${step.char}'`,
            `stack.pop()  # '${step.opened}' matches '${step.char}'`,
            `st.pop(); // '${step.opened}' matches '${step.char}'`,
        );
        stack = stack.slice(0, -1);
    } else if (step.kind === 'skip') {
        logOpBM(
            `// "${step.char}" is not a bracket, ignore`,
            `# "${step.char}" is not a bracket, ignore`,
            `// "${step.char}" is not a bracket, ignore`,
        );
    } else if (step.kind === 'error') {
        logOpBM(
            `// mismatch: ${step.reason} -> return false`,
            `# mismatch: ${step.reason} -> return False`,
            `// mismatch: ${step.reason} -> return false`,
        );
        errorMsg = step.reason ?? null;
    } else if (step.kind === 'unbalanced-end') {
        logOpBM(
            `// stack not empty: [${step.leftover?.join(', ')}] left open -> return false`,
            `# stack not empty: [${step.leftover?.join(', ')}] left open -> return False`,
            `// stack not empty: [${step.leftover?.join(', ')}] left open -> return false`,
        );
        errorMsg = `${step.leftover?.length} bracket(s) never closed: ${step.leftover?.join(' ')}`;
    } else if (step.kind === 'balanced') {
        logOpBM(
            '// stack empty at the end -> return true',
            '# stack empty at the end -> return True',
            '// stack empty at the end -> return true',
        );
    }

    const isLastStep = nextIndex >= state.steps.length - 1;

    bracketState.update((s) => ({
        ...s,
        stack,
        errorMsg,
        stepIndex: nextIndex,
    }));

    if (isLastStep) {
        if (state.result === 'balanced') {
            toast.success('Balanced!');
        } else {
            toast.error('Unbalanced');
        }
        bracketState.update((s) => ({ ...s, playing: false, done: true }));
        closeSession();
    }
}

export function playPause() {
    const state = get(bracketState);

    if (state.playing) {
        stopInterval();
        bracketState.update((s) => ({ ...s, playing: false }));
        return;
    }

    if (state.steps.length === 0 || state.stepIndex >= state.steps.length - 1) return;

    bracketState.update((s) => ({ ...s, playing: true }));
    intervalId = setInterval(stepForward, state.speed);
}

/** Halts playback and closes the undo bracket, without clearing the run off-screen. */
export function stopRun() {
    closeSession();
    bracketState.update((s) => ({ ...s, playing: false }));
}

/** Fully clears the run — use when the page is reset (New/Load) or unmounted. */
export function resetBracketMatching() {
    stopInterval();
    sessionActive = false;
    frameCounter = 0;
    bracketState.set({
        input: '',
        steps: [],
        stepIndex: -1,
        stack: [],
        playing: false,
        speed: get(bracketState).speed,
        done: false,
        result: null,
        errorMsg: null,
    });
}

/** @param {number} speed */
export function setBracketSpeed(speed) {
    bracketState.update((s) => ({ ...s, speed }));
    if (get(bracketState).playing) {
        stopInterval();
        intervalId = setInterval(stepForward, speed);
    }
}

export function initBracketMatching() {
    logOpBM(
        'Deque<Character> stack = new ArrayDeque<>(); // holds unmatched open brackets',
        'stack = []  # holds unmatched open brackets',
        'std::stack<char> stack; // holds unmatched open brackets',
    );
}

export function getSnapshotBM() {
    return {
        state: cloneStoreValue(bracketState),
        counter: frameCounter,
        codeLog: cloneStoreValue(bracketMatchingLog),
        _type: 'bracket-matching',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotBM>} snapshot
 */
export function applySnapshotBM(snapshot) {
    stopInterval();
    frameCounter = snapshot.counter ?? 0;
    if (snapshot.state) {
        bracketState.set({ ...snapshot.state, playing: false });
    }
    if (snapshot.codeLog) bracketMatchingLog.set(snapshot.codeLog);
}
