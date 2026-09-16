import { writable, get } from 'svelte/store';
import { logOpFC, functionCallLog } from '../shared/functionCallLog.js';
import { pushHistory } from '../shared/history.js';
import { toast } from '../shared/toast.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: recursion modelled as an explicit call stack. Calling
 * `factorial(n)` recurses down to the base case — one frame pushed per
 * call — then unwinds back up, one frame popped per return, multiplying
 * as it goes. This is exactly what the language runtime's own call stack
 * does for you; here it's made visible.
 *
 * @typedef {{ kind: 'call'|'return', n: number, value?: number }} CallStep
 * @typedef {{ id: string, n: number }} Frame
 * @typedef {{
 *   n: number|null,
 *   frames: Frame[],
 *   steps: CallStep[],
 *   stepIndex: number,
 *   lastReturn: { n: number, value: number }|null,
 *   playing: boolean,
 *   speed: number,
 *   done: boolean,
 *   result: number|null,
 * }} CallStackState
 */

const MIN_N = 0;
const MAX_N = 10;

const FACTORIAL_METHOD = {
    java: `int factorial(int n) {\n    // JVM pushes a new frame for this call\n    if (n <= 1) return 1;         // base case: nothing left to push\n    int sub = factorial(n - 1);   // recurse — pushes the next frame\n    return n * sub;               // this frame pops as it returns\n}`,
    python: `def factorial(n):\n    # the interpreter pushes a new frame for this call\n    if n <= 1:\n        return 1               # base case: nothing left to push\n    sub = factorial(n - 1)     # recurse — pushes the next frame\n    return n * sub             # this frame pops as it returns`,
    cpp: `int factorial(int n) {\n    // the runtime pushes a new frame for this call\n    if (n <= 1) return 1;         // base case: nothing left to push\n    int sub = factorial(n - 1);   // recurse — pushes the next frame\n    return n * sub;               // this frame pops as it returns\n}`,
};

/** @type {import('svelte/store').Writable<CallStackState>} */
export const callStackState = writable({
    n: null,
    frames: [],
    steps: [],
    stepIndex: -1,
    lastReturn: null,
    playing: false,
    speed: 700,
    done: false,
    result: null,
});

/** @type {ReturnType<typeof setInterval>|null} */
let intervalId = null;

/** True between runFactorial() and the matching pushHistory() that closes the bracket. */
let sessionActive = false;

let frameCounter = 0;

/**
 * @param {number} n
 * @returns {{ steps: CallStep[], result: number }}
 */
function computeSteps(n) {
    /** @type {CallStep[]} */
    const steps = [];

    if (n === 0) {
        steps.push({ kind: 'call', n: 0 });
        steps.push({ kind: 'return', n: 0, value: 1 });
        return { steps, result: 1 };
    }

    for (let i = n; i >= 1; i--) steps.push({ kind: 'call', n: i });

    /** @type {Record<number, number>} */
    const fact = { 1: 1 };
    steps.push({ kind: 'return', n: 1, value: 1 });
    for (let i = 2; i <= n; i++) {
        fact[i] = i * fact[i - 1];
        steps.push({ kind: 'return', n: i, value: fact[i] });
    }

    return { steps, result: fact[n] ?? 1 };
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

/** @param {string|number} rawN */
export function runFactorial(rawN) {
    stopInterval();

    const n = Number(rawN);
    if (!Number.isInteger(n) || n < MIN_N || n > MAX_N) {
        toast.error(`Enter a whole number from ${MIN_N} to ${MAX_N}`);
        return;
    }

    const { steps, result } = computeSteps(n);

    if (!sessionActive) {
        pushHistory();
        sessionActive = true;
    }

    logOpFC(FACTORIAL_METHOD.java, FACTORIAL_METHOD.python, FACTORIAL_METHOD.cpp);
    logOpFC(
        `// factorial(${n}) called from the top level`,
        `# factorial(${n}) called from the top level`,
        `// factorial(${n}) called from the top level`,
    );

    callStackState.set({
        n,
        frames: [],
        steps,
        stepIndex: -1,
        lastReturn: null,
        playing: false,
        speed: get(callStackState).speed,
        done: false,
        result,
    });
}

export function stepForward() {
    const state = get(callStackState);
    if (state.stepIndex >= state.steps.length - 1) {
        stopInterval();
        callStackState.update((s) => ({ ...s, playing: false }));
        return;
    }

    const nextIndex = state.stepIndex + 1;
    const step = state.steps[nextIndex];
    /** @type {Frame[]} */
    let frames = state.frames;
    /** @type {{ n: number, value: number }|null} */
    let lastReturn = state.lastReturn;

    if (step.kind === 'call') {
        logOpFC(
            `// call factorial(${step.n}) — push a new frame`,
            `# call factorial(${step.n}) — push a new frame`,
            `// call factorial(${step.n}) — push a new frame`,
        );
        frames = [...frames, { id: `frame_${++frameCounter}`, n: step.n }];
    } else {
        const note = step.n <= 1 ? 'base case' : `${step.n} * factorial(${step.n - 1})`;
        logOpFC(
            `// factorial(${step.n}) returns ${step.value} (${note}) — pop the frame`,
            `# factorial(${step.n}) returns ${step.value} (${note}) — pop the frame`,
            `// factorial(${step.n}) returns ${step.value} (${note}) — pop the frame`,
        );
        frames = frames.slice(0, -1);
        lastReturn = { n: step.n, value: step.value ?? 0 };
    }

    const isLastStep = nextIndex >= state.steps.length - 1;

    callStackState.update((s) => ({
        ...s,
        frames,
        lastReturn,
        stepIndex: nextIndex,
    }));

    if (isLastStep) {
        logOpFC(
            `// factorial(${state.n}) = ${state.result}`,
            `# factorial(${state.n}) = ${state.result}`,
            `// factorial(${state.n}) = ${state.result}`,
        );
        toast.success(`factorial(${state.n}) = ${state.result}`);
        callStackState.update((s) => ({ ...s, playing: false, done: true }));
        closeSession();
    }
}

export function playPause() {
    const state = get(callStackState);

    if (state.playing) {
        stopInterval();
        callStackState.update((s) => ({ ...s, playing: false }));
        return;
    }

    if (state.steps.length === 0 || state.stepIndex >= state.steps.length - 1) return;

    callStackState.update((s) => ({ ...s, playing: true }));
    intervalId = setInterval(stepForward, state.speed);
}

/** Halts playback and closes the undo bracket, without clearing the run off-screen. */
export function stopRun() {
    closeSession();
    callStackState.update((s) => ({ ...s, playing: false }));
}

/** Fully clears the run — use when the page is reset (New/Load) or unmounted. */
export function resetFunctionCall() {
    stopInterval();
    sessionActive = false;
    frameCounter = 0;
    callStackState.set({
        n: null,
        frames: [],
        steps: [],
        stepIndex: -1,
        lastReturn: null,
        playing: false,
        speed: get(callStackState).speed,
        done: false,
        result: null,
    });
}

/** @param {number} speed */
export function setCallStackSpeed(speed) {
    callStackState.update((s) => ({ ...s, speed }));
    if (get(callStackState).playing) {
        stopInterval();
        intervalId = setInterval(stepForward, speed);
    }
}

export function initFunctionCall() {
    logOpFC(
        'Deque<Integer> callStack = new ArrayDeque<>(); // one frame per pending call',
        'call_stack = []  # one frame per pending call',
        'std::stack<int> callStack; // one frame per pending call',
    );
}

export function getSnapshotFC() {
    return {
        state: cloneStoreValue(callStackState),
        counter: frameCounter,
        codeLog: cloneStoreValue(functionCallLog),
        _type: 'function-call',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotFC>} snapshot
 */
export function applySnapshotFC(snapshot) {
    stopInterval();
    frameCounter = snapshot.counter ?? 0;
    if (snapshot.state) {
        callStackState.set({ ...snapshot.state, playing: false });
    }
    if (snapshot.codeLog) functionCallLog.set(snapshot.codeLog);
}
