import { writable, get } from 'svelte/store';
import { pushStack, popStack, initStack } from './graphStack.js';
import { logOpStack } from '../shared/stackLog.js';
import { pushHistory } from '../shared/history.js';
import { toast } from '../shared/toast.js';

/**
 * @typedef {'convert'|'evaluate'} ExpressionMode
 * @typedef {{ token: string|null, tokenIndex: number, kind: 'push'|'pop'|'discard'|'output', value: string, note?: string, outputSnapshot?: string[] }} ExpressionStep
 * @typedef {{ mode: ExpressionMode, tokens: string[], currentToken: string|null, steps: ExpressionStep[], stepIndex: number, output: string[], playing: boolean, speed: number, done: boolean, result: string|null }} ExpressionState
 */

/** @type {Record<string, number>} */
const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
const RIGHT_ASSOC = new Set(['^']);
const OPERATORS = new Set(Object.keys(PRECEDENCE));

const CONVERT_METHOD = {
    java: `String infixToPostfix(String infix) {\n    Stack<Character> ops = new Stack<>();\n    StringBuilder postfix = new StringBuilder();\n    for (char c : infix.toCharArray()) {\n        if (Character.isLetterOrDigit(c)) {\n            postfix.append(c);\n        } else if (c == '(') {\n            ops.push(c);\n        } else if (c == ')') {\n            while (ops.peek() != '(') postfix.append(ops.pop());\n            ops.pop();\n        } else {\n            while (!ops.isEmpty() && precedence(ops.peek()) >= precedence(c)) {\n                postfix.append(ops.pop());\n            }\n            ops.push(c);\n        }\n    }\n    while (!ops.isEmpty()) postfix.append(ops.pop());\n    return postfix.toString();\n}`,
    python: `def infix_to_postfix(infix):\n    ops = []\n    postfix = []\n    for c in infix:\n        if c.isalnum():\n            postfix.append(c)\n        elif c == '(':\n            ops.append(c)\n        elif c == ')':\n            while ops[-1] != '(':\n                postfix.append(ops.pop())\n            ops.pop()\n        else:\n            while ops and precedence(ops[-1]) >= precedence(c):\n                postfix.append(ops.pop())\n            ops.append(c)\n    while ops:\n        postfix.append(ops.pop())\n    return ''.join(postfix)`,
    cpp: `std::string infixToPostfix(std::string infix) {\n    std::stack<char> ops;\n    std::string postfix;\n    for (char c : infix) {\n        if (isalnum(c)) {\n            postfix += c;\n        } else if (c == '(') {\n            ops.push(c);\n        } else if (c == ')') {\n            while (ops.top() != '(') { postfix += ops.top(); ops.pop(); }\n            ops.pop();\n        } else {\n            while (!ops.empty() && precedence(ops.top()) >= precedence(c)) {\n                postfix += ops.top(); ops.pop();\n            }\n            ops.push(c);\n        }\n    }\n    while (!ops.empty()) { postfix += ops.top(); ops.pop(); }\n    return postfix;\n}`,
};

const EVALUATE_METHOD = {
    java: `int evaluatePostfix(String postfix) {\n    Stack<Integer> values = new Stack<>();\n    for (String token : postfix.split(" ")) {\n        if (isNumber(token)) {\n            values.push(Integer.parseInt(token));\n        } else {\n            int b = values.pop();\n            int a = values.pop();\n            values.push(apply(a, b, token.charAt(0)));\n        }\n    }\n    return values.pop();\n}`,
    python: `def evaluate_postfix(postfix):\n    values = []\n    for token in postfix.split():\n        if is_number(token):\n            values.append(float(token))\n        else:\n            b = values.pop()\n            a = values.pop()\n            values.append(apply(a, b, token))\n    return values.pop()`,
    cpp: `int evaluatePostfix(std::string postfix) {\n    std::stack<int> values;\n    std::istringstream iss(postfix);\n    std::string token;\n    while (iss >> token) {\n        if (isdigit(token[0])) {\n            values.push(std::stoi(token));\n        } else {\n            int b = values.top(); values.pop();\n            int a = values.top(); values.pop();\n            values.push(apply(a, b, token[0]));\n        }\n    }\n    return values.top();\n}`,
};

/** @type {import('svelte/store').Writable<ExpressionState>} */
export const expressionState = writable({
    mode: 'convert',
    tokens: [],
    currentToken: null,
    steps: [],
    stepIndex: -1,
    output: [],
    playing: false,
    speed: 700,
    done: false,
    result: null,
});

/** @type {ReturnType<typeof setInterval>|null} */
let intervalId = null;

/** True between startConvert/startEvaluate and the matching pushHistory() that closes the bracket. */
let sessionActive = false;

/**
 * @param {string} tok
 */
function isOperand(tok) {
    return /^\d+(\.\d+)?$/.test(tok) || /^[A-Za-z]+$/.test(tok);
}

/**
 * @param {string} expr
 * @returns {string[]|null}
 */
function tokenizeInfix(expr) {
    const trimmed = expr.trim();
    if (!/^[A-Za-z0-9.()+\-*/%^\s]*$/.test(trimmed)) return null;
    return trimmed.match(/\d+\.\d+|\d+|[A-Za-z]+|[()+\-*/%^]/g) || [];
}

/**
 * @param {string} expr
 * @returns {string[]|null}
 */
function tokenizePostfix(expr) {
    const trimmed = expr.trim();
    if (!trimmed) return [];
    if (!/^[A-Za-z0-9.+\-*/%^\s]*$/.test(trimmed)) return null;
    return trimmed.split(/\s+/);
}

class ExpressionError extends Error {}

/**
 * @param {string[]} tokens
 * @returns {{ steps: ExpressionStep[], result: string }|{ error: string }}
 */
function computeConvertSteps(tokens) {
    try {
        return computeConvertStepsInner(tokens);
    } catch (e) {
        if (e instanceof ExpressionError) return { error: e.message };
        throw e;
    }
}

/**
 * @param {string[]} tokens
 * @returns {{ steps: ExpressionStep[], result: string }}
 */
function computeConvertStepsInner(tokens) {
    /** @type {ExpressionStep[]} */
    const steps = [];
    /** @type {string[]} */
    const stack = [];
    /** @type {string[]} */
    const output = [];

    tokens.forEach((tok, tokenIndex) => {
        if (isOperand(tok)) {
            output.push(tok);
            steps.push({ token: tok, tokenIndex, kind: 'output', value: tok, outputSnapshot: [...output] });
        } else if (tok === '(') {
            stack.push(tok);
            steps.push({ token: tok, tokenIndex, kind: 'push', value: tok });
        } else if (tok === ')') {
            while (stack.length && stack[stack.length - 1] !== '(') {
                const op = /** @type {string} */ (stack.pop());
                output.push(op);
                steps.push({ token: tok, tokenIndex, kind: 'pop', value: op, note: 'precedence', outputSnapshot: [...output] });
            }
            if (stack.length === 0) throw new ExpressionError('Mismatched parentheses');
            stack.pop();
            steps.push({ token: tok, tokenIndex, kind: 'discard', value: '(' });
        } else if (OPERATORS.has(tok)) {
            while (
                stack.length &&
                stack[stack.length - 1] !== '(' &&
                (PRECEDENCE[stack[stack.length - 1]] > PRECEDENCE[tok] ||
                    (PRECEDENCE[stack[stack.length - 1]] === PRECEDENCE[tok] && !RIGHT_ASSOC.has(tok)))
            ) {
                const op = /** @type {string} */ (stack.pop());
                output.push(op);
                steps.push({ token: tok, tokenIndex, kind: 'pop', value: op, note: 'precedence', outputSnapshot: [...output] });
            }
            stack.push(tok);
            steps.push({ token: tok, tokenIndex, kind: 'push', value: tok });
        } else {
            throw new ExpressionError(`Unrecognized token "${tok}"`);
        }
    });

    while (stack.length) {
        const op = /** @type {string} */ (stack.pop());
        if (op === '(') throw new ExpressionError('Mismatched parentheses');
        output.push(op);
        steps.push({ token: null, tokenIndex: -1, kind: 'pop', value: op, note: 'remaining', outputSnapshot: [...output] });
    }

    return { steps, result: output.join(' ') };
}

/**
 * @param {string[]} tokens
 * @returns {{ steps: ExpressionStep[], result: string }|{ error: string }}
 */
function computeEvaluateSteps(tokens) {
    /** @type {ExpressionStep[]} */
    const steps = [];
    /** @type {number[]} */
    const stack = [];

    for (const [tokenIndex, tok] of tokens.entries()) {
        if (/^-?\d+(\.\d+)?$/.test(tok)) {
            stack.push(Number(tok));
            steps.push({ token: tok, tokenIndex, kind: 'push', value: tok });
        } else if (OPERATORS.has(tok)) {
            if (stack.length < 2) return { error: `Not enough operands for "${tok}"` };
            const b = /** @type {number} */ (stack.pop());
            const a = /** @type {number} */ (stack.pop());
            steps.push({ token: tok, tokenIndex, kind: 'pop', value: String(b) });
            steps.push({ token: tok, tokenIndex, kind: 'pop', value: String(a) });

            /** @type {number} */
            let result;
            switch (tok) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/':
                    if (b === 0) return { error: 'Division by zero' };
                    result = a / b;
                    break;
                case '%':
                    if (b === 0) return { error: 'Division by zero' };
                    result = a % b;
                    break;
                case '^': result = Math.pow(a, b); break;
                default: result = NaN;
            }
            stack.push(result);
            steps.push({ token: tok, tokenIndex, kind: 'push', value: String(result), note: `${a} ${tok} ${b} = ${result}` });
        } else {
            return { error: `"${tok}" is not a number or operator` };
        }
    }

    if (stack.length !== 1) return { error: 'Malformed postfix expression' };
    return { steps, result: String(stack[0]) };
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

/**
 * @param {ExpressionMode} mode
 * @param {string} rawInput
 */
function startSession(mode, rawInput) {
    stopInterval();

    const tokens = mode === 'convert' ? tokenizeInfix(rawInput) : tokenizePostfix(rawInput);
    if (tokens === null) {
        toast.error('Expression contains unsupported characters');
        return;
    }
    if (tokens.length === 0) {
        toast.error('Enter an expression first');
        return;
    }

    const computed = mode === 'convert' ? computeConvertSteps(tokens) : computeEvaluateSteps(tokens);
    if ('error' in computed) {
        toast.error(computed.error);
        return;
    }

    if (!sessionActive) {
        pushHistory();
        sessionActive = true;
    }

    // Fresh array stack for this run — String ops for the conversion
    // scratch stack, int operands for the evaluation stack.
    initStack(Math.max(tokens.length, 1), mode === 'convert' ? 'ops' : 'values', mode === 'convert' ? 'String' : 'int');

    const method = mode === 'convert' ? CONVERT_METHOD : EVALUATE_METHOD;
    logOpStack(method.java, method.python, method.cpp);

    expressionState.set({
        mode,
        tokens,
        currentToken: null,
        steps: computed.steps,
        stepIndex: -1,
        output: [],
        playing: false,
        speed: get(expressionState).speed,
        done: false,
        result: computed.result,
    });
}

/** @param {string} rawInput */
export function startConvert(rawInput) {
    startSession('convert', rawInput);
}

/** @param {string} rawInput */
export function startEvaluate(rawInput) {
    startSession('evaluate', rawInput);
}

export function stepForward() {
    const state = get(expressionState);
    if (state.stepIndex >= state.steps.length - 1) {
        stopInterval();
        expressionState.update(s => ({ ...s, playing: false }));
        return;
    }

    const nextIndex = state.stepIndex + 1;
    const step = state.steps[nextIndex];
    const tokenLabel = step.token != null ? `"${step.token}"` : 'remaining operator';
    const noteSuffix = step.note ? ` (${step.note})` : '';

    if (step.kind === 'push') {
        logOpStack(
            `// token ${tokenLabel}: push "${step.value}"${noteSuffix}`,
            `# token ${tokenLabel}: push "${step.value}"${noteSuffix}`,
            `// token ${tokenLabel}: push "${step.value}"${noteSuffix}`
        );
        pushStack(step.value);
    } else if (step.kind === 'pop') {
        logOpStack(
            `// pop "${step.value}" for token ${tokenLabel}${noteSuffix}`,
            `# pop "${step.value}" for token ${tokenLabel}${noteSuffix}`,
            `// pop "${step.value}" for token ${tokenLabel}${noteSuffix}`
        );
        popStack();
    } else if (step.kind === 'discard') {
        logOpStack(
            `// discard "(" for token ${tokenLabel}`,
            `# discard "(" for token ${tokenLabel}`,
            `// discard "(" for token ${tokenLabel}`
        );
        popStack();
    } else if (step.kind === 'output') {
        logOpStack(
            `postfix += "${step.value}"; // token ${tokenLabel} is an operand`,
            `postfix += "${step.value}"  # token ${tokenLabel} is an operand`,
            `postfix += "${step.value}"; // token ${tokenLabel} is an operand`
        );
    }

    const isLastStep = nextIndex >= state.steps.length - 1;

    expressionState.update(s => ({
        ...s,
        stepIndex: nextIndex,
        currentToken: step.token,
        output: step.outputSnapshot ?? s.output,
    }));

    if (isLastStep) {
        if (state.mode === 'convert') {
            logOpStack(
                `// postfix result: "${state.result}"`,
                `# postfix result: "${state.result}"`,
                `// postfix result: "${state.result}"`
            );
            toast.success(`Postfix: ${state.result}`);
        } else {
            logOpStack(
                `// result: ${state.result}`,
                `# result: ${state.result}`,
                `// result: ${state.result}`
            );
            toast.success(`Result: ${state.result}`);
        }
        expressionState.update(s => ({ ...s, playing: false, done: true }));
        closeSession();
    }
}

export function playPause() {
    const state = get(expressionState);

    if (state.playing) {
        stopInterval();
        expressionState.update(s => ({ ...s, playing: false }));
        return;
    }

    if (state.steps.length === 0 || state.stepIndex >= state.steps.length - 1) return;

    expressionState.update(s => ({ ...s, playing: true }));
    intervalId = setInterval(stepForward, state.speed);
}

/** Halts playback and clears the current run, without touching the array stack itself. */
export function stopExpression() {
    closeSession();
    expressionState.update(s => ({
        ...s,
        tokens: [],
        currentToken: null,
        steps: [],
        stepIndex: -1,
        output: [],
        playing: false,
        done: false,
        result: null,
    }));
}

/** Fully clears playback state — use when the stack itself is replaced (New/Load). */
export function resetExpression() {
    stopInterval();
    sessionActive = false;
    expressionState.update(s => ({
        ...s,
        tokens: [],
        currentToken: null,
        steps: [],
        stepIndex: -1,
        output: [],
        playing: false,
        done: false,
        result: null,
    }));
}

/** @param {number} speed */
export function setExpressionSpeed(speed) {
    expressionState.update(s => ({ ...s, speed }));

    if (get(expressionState).playing) {
        stopInterval();
        intervalId = setInterval(stepForward, speed);
    }
}
