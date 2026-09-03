import { writable, get, derived } from 'svelte/store';
import { logOpBH, browserHistoryLog } from '../shared/browserHistoryLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: the browser Back/Forward mechanism modelled with two
 * stacks. `backStack` holds the pages behind the current one (top = the
 * page you'd land on if you hit Back); `forwardStack` holds the pages you
 * backed out of (top = the page you'd land on if you hit Forward). The
 * learner never touches the stacks directly — only Visit / Back / Forward.
 *
 * @typedef {{ id: string, url: string }} Page
 */

/** @type {import('svelte/store').Writable<Page|null>} */
export const currentPage = writable(null);

/** Stack 1 — visited pages behind the current one (top is the last element). */
/** @type {import('svelte/store').Writable<Page[]>} */
export const backStack = writable([]);

/** Stack 2 — pages we've stepped back from (top is the last element). */
/** @type {import('svelte/store').Writable<Page[]>} */
export const forwardStack = writable([]);

export const canGoBack = derived(backStack, ($b) => $b.length > 0);
export const canGoForward = derived(forwardStack, ($f) => $f.length > 0);
export const hasVisited = derived(currentPage, ($c) => $c !== null);

let pageCounter = 0;

/** @param {string} url */
function makePage(url) {
    return { id: `page_${++pageCounter}`, url };
}

/**
 * Turn whatever the user typed into a usable URL: trim, drop stray spaces,
 * and assume https:// when no scheme is given.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
    let s = String(raw ?? '').trim().replace(/\s+/g, '');
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    return s;
}

/**
 * Deterministically derive a dummy website's look from its URL so revisiting
 * the same address always renders the same fake page.
 * @param {string} url
 */
export function dummySite(url) {
    let host = url;
    try {
        host = new URL(url).hostname;
    } catch {
        host = url.replace(/^https?:\/\//i, '').split('/')[0];
    }
    const bareHost = host.replace(/^www\./, '') || host;
    const label = bareHost.split('.')[0] || bareHost;
    const title = label.charAt(0).toUpperCase() + label.slice(1);

    let h = 0;
    for (let i = 0; i < bareHost.length; i++) {
        h = (h * 31 + bareHost.charCodeAt(i)) >>> 0;
    }

    const NAV = ['Home', 'About', 'Products', 'Docs', 'Blog', 'Pricing', 'Contact'];
    const navItems = NAV.slice(0, 3 + (h % 3));
    const TAGLINES = [
        'Everything you need, in one place.',
        'Fast, simple, and refreshingly reliable.',
        'Built for people who sweat the details.',
        'The modern way to get things done.',
        'Welcome aboard — let’s get started.',
    ];

    return {
        host,
        bareHost,
        title,
        hue: h % 360,
        navItems,
        paraCount: 2 + (h % 3),
        tagline: TAGLINES[h % TAGLINES.length],
    };
}

export function initBrowserHistory() {
    logOpBH(
        [
            'Deque<String> back = new ArrayDeque<>();    // stack 1: pages behind us',
            'Deque<String> forward = new ArrayDeque<>(); // stack 2: pages ahead of us',
            'String current = null;',
        ],
        [
            'back = []       # stack 1: pages behind us',
            'forward = []    # stack 2: pages ahead of us',
            'current = None',
        ],
        [
            'std::stack<std::string> back;    // stack 1: pages behind us',
            'std::stack<std::string> forward; // stack 2: pages ahead of us',
            'std::string current;',
        ],
    );
}

/**
 * Type a URL and press Enter. The page currently on screen (if any) is
 * pushed onto the back stack, and — because this is a brand-new navigation —
 * the forward stack is thrown away.
 * @param {string} raw
 * @returns {string|false} the normalized URL that was visited, or false
 */
export function visitUrl(raw) {
    const url = normalizeUrl(raw);
    if (!url) return false;

    const cur = get(currentPage);
    if (cur) backStack.update((s) => [...s, cur]);
    currentPage.set(makePage(url));
    forwardStack.set([]);

    logOpBH(
        [
            `// visit("${url}")`,
            'if (current != null) back.push(current); // remember where we were',
            `current = "${url}";`,
            'forward.clear();                         // a new path kills the forward history',
        ],
        [
            `# visit("${url}")`,
            'if current is not None:',
            '    back.append(current)  # remember where we were',
            `current = "${url}"`,
            'forward.clear()           # a new path kills the forward history',
        ],
        [
            `// visit("${url}")`,
            'if (!current.empty()) back.push(current);',
            `current = "${url}";`,
            'while (!forward.empty()) forward.pop();',
        ],
    );
    return url;
}

/**
 * Back button: the on-screen page is pushed onto the forward stack, and the
 * top of the back stack becomes the on-screen page.
 * @returns {boolean}
 */
export function goBack() {
    const back = get(backStack);
    if (back.length === 0) return false;

    const cur = get(currentPage);
    if (cur) forwardStack.update((s) => [...s, cur]);
    const prev = back[back.length - 1];
    backStack.set(back.slice(0, -1));
    currentPage.set(prev);

    logOpBH(
        [
            '// back button',
            'forward.push(current);   // current page goes onto stack 2',
            'current = back.pop();    // previous page comes off stack 1',
        ],
        [
            '# back button',
            'forward.append(current)  # current page goes onto stack 2',
            'current = back.pop()     # previous page comes off stack 1',
        ],
        [
            '// back button',
            'forward.push(current);',
            'current = back.top(); back.pop();',
        ],
    );
    return true;
}

/**
 * Forward button: the mirror image of Back — the on-screen page goes back
 * onto the back stack, and the top of the forward stack is shown.
 * @returns {boolean}
 */
export function goForward() {
    const forward = get(forwardStack);
    if (forward.length === 0) return false;

    const cur = get(currentPage);
    if (cur) backStack.update((s) => [...s, cur]);
    const next = forward[forward.length - 1];
    forwardStack.set(forward.slice(0, -1));
    currentPage.set(next);

    logOpBH(
        [
            '// forward button',
            'back.push(current);        // current page goes back onto stack 1',
            'current = forward.pop();   // next page comes off stack 2',
        ],
        [
            '# forward button',
            'back.append(current)       # current page goes back onto stack 1',
            'current = forward.pop()    # next page comes off stack 2',
        ],
        [
            '// forward button',
            'back.push(current);',
            'current = forward.top(); forward.pop();',
        ],
    );
    return true;
}

export function resetBrowserHistory() {
    pageCounter = 0;
    currentPage.set(null);
    backStack.set([]);
    forwardStack.set([]);
}

export function getSnapshotBH() {
    return {
        current: get(currentPage),
        backStack: cloneStoreValue(backStack),
        forwardStack: cloneStoreValue(forwardStack),
        counter: pageCounter,
        codeLog: cloneStoreValue(browserHistoryLog),
        _type: 'browser-history',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotBH>} snapshot
 */
export function applySnapshotBH(snapshot) {
    pageCounter = snapshot.counter ?? 0;
    currentPage.set(snapshot.current ?? null);
    backStack.set(snapshot.backStack ?? []);
    forwardStack.set(snapshot.forwardStack ?? []);
    if (snapshot.codeLog) browserHistoryLog.set(snapshot.codeLog);
}
