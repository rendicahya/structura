import { writable, get, derived } from 'svelte/store';
import { logOpTD, todoListLog } from '../shared/todoListLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a to-do list modelled as a singly linked list of task
 * nodes, each pointing to `next`. Adding a task walks from `head` to the
 * tail and links the new node there — O(n), the classic reason a bare
 * singly linked list gets a `tail` pointer or upgraded to a doubly linked
 * list. Completing a task flips a flag on its node; deleting one relinks the
 * predecessor's `next` around it. The learner drives it through the
 * checklist UI, never the list directly.
 *
 * @typedef {{ id: string, text: string, done: boolean }} Todo
 */

/** @type {import('svelte/store').Writable<Todo[]>} head → tail order */
export const todos = writable([]);

let todoCounter = 0;

export const tdIsEmpty = derived(todos, ($t) => $t.length === 0);
export const tdCount = derived(todos, ($t) => $t.length);
export const tdRemaining = derived(todos, ($t) => $t.filter((x) => !x.done).length);

/**
 * @param {string} text
 * @returns {Todo}
 */
function makeTodo(text) {
    return {
        id: `todo_${++todoCounter}`,
        text: String(text ?? '').trim() || 'Untitled task',
        done: false,
    };
}

export function initTodoList() {
    logOpTD(
        [
            'class Node {',
            '    String text;',
            '    boolean done;',
            '    Node next;',
            '}',
            'Node head;',
        ],
        [
            'class Node:',
            '    def __init__(self, text):',
            '        self.text = text',
            '        self.done = False',
            '        self.next = None',
            '',
            'head = None',
        ],
        [
            'struct Node {',
            '    std::string text;',
            '    bool done = false;',
            '    Node* next = nullptr;',
            '};',
            'Node* head = nullptr;',
        ],
    );
}

/**
 * Append a task at the tail — walk from head to the last node, then link.
 * @param {string} text
 * @returns {Todo}
 */
export function addTodo(text) {
    const t = makeTodo(text);
    const list = get(todos);
    todos.set([...list, t]);
    const first = list.length === 0;

    logOpTD(
        first
            ? [`head = new Node("${t.text}");`]
            : [
                  `Node n = new Node("${t.text}");`,
                  'Node cur = head;',
                  `while (cur.next != null) cur = cur.next;   // O(n) walk — ${list.length} hop${list.length === 1 ? '' : 's'}`,
                  'cur.next = n;',
              ],
        first
            ? ['head = Node("' + t.text + '")']
            : [
                  `n = Node("${t.text}")`,
                  'cur = head',
                  `while cur.next: cur = cur.next   # O(n) walk — ${list.length} hop${list.length === 1 ? '' : 's'}`,
                  'cur.next = n',
              ],
        first
            ? [`head = new Node{"${t.text}"};`]
            : [
                  `Node* n = new Node{"${t.text}"};`,
                  'Node* cur = head;',
                  `while (cur->next) cur = cur->next;   // O(n) walk — ${list.length} hop${list.length === 1 ? '' : 's'}`,
                  'cur->next = n;',
              ],
    );
    return t;
}

/**
 * Toggle a task's done flag — walk to the node, flip it in place.
 * @param {string} id
 */
export function toggleTodo(id) {
    const list = get(todos);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    const node = list[idx];
    const nextDone = !node.done;
    todos.set(list.map((x) => (x.id === id ? { ...x, done: nextDone } : x)));

    logOpTD(
        [
            'Node cur = head;',
            `while (!cur.text.equals("${node.text}")) cur = cur.next;   // ${idx} hop${idx === 1 ? '' : 's'}`,
            `cur.done = ${nextDone};`,
        ],
        [
            'cur = head',
            `while cur.text != "${node.text}": cur = cur.next   # ${idx} hop${idx === 1 ? '' : 's'}`,
            `cur.done = ${nextDone ? 'True' : 'False'}`,
        ],
        [
            'Node* cur = head;',
            `while (cur->text != "${node.text}") cur = cur->next;   // ${idx} hop${idx === 1 ? '' : 's'}`,
            `cur->done = ${nextDone};`,
        ],
    );
    return true;
}

/**
 * Delete a task — track the predecessor while walking, then relink its
 * `next` past the removed node (or move `head` if it was first).
 * @param {string} id
 */
export function removeTodo(id) {
    const list = get(todos);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    const node = list[idx];
    todos.set(list.filter((x) => x.id !== id));

    logOpTD(
        idx === 0
            ? [`// remove "${node.text}" (head)`, 'head = head.next;']
            : [
                  `// remove "${node.text}"`,
                  'Node prev = head, cur = head.next;',
                  `while (!cur.text.equals("${node.text}")) { prev = cur; cur = cur.next; }`,
                  'prev.next = cur.next;   // unlink',
              ],
        idx === 0
            ? [`# remove "${node.text}" (head)`, 'head = head.next']
            : [
                  `# remove "${node.text}"`,
                  'prev, cur = head, head.next',
                  `while cur.text != "${node.text}": prev, cur = cur, cur.next`,
                  'prev.next = cur.next   # unlink',
              ],
        idx === 0
            ? [`// remove "${node.text}" (head)`, 'Node* old = head; head = head->next; delete old;']
            : [
                  `// remove "${node.text}"`,
                  'Node *prev = head, *cur = head->next;',
                  `while (cur->text != "${node.text}") { prev = cur; cur = cur->next; }`,
                  'prev->next = cur->next; delete cur;   // unlink',
              ],
    );
    return true;
}

/**
 * Drop every completed task in one pass, relinking around each.
 */
export function clearCompleted() {
    const list = get(todos);
    const removed = list.filter((x) => x.done).length;
    if (removed === 0) return 0;
    todos.set(list.filter((x) => !x.done));

    logOpTD(
        [
            'Node prev = null, cur = head;',
            'while (cur != null) {',
            '    if (cur.done) {',
            '        if (prev == null) head = cur.next; else prev.next = cur.next;',
            '    } else prev = cur;',
            '    cur = cur.next;',
            `}   // unlinked ${removed} node${removed === 1 ? '' : 's'}`,
        ],
        [
            'prev, cur = None, head',
            'while cur:',
            '    if cur.done:',
            '        if prev is None: head = cur.next',
            '        else: prev.next = cur.next',
            '    else:',
            '        prev = cur',
            '    cur = cur.next',
            `# unlinked ${removed} node${removed === 1 ? '' : 's'}`,
        ],
        [
            'Node *prev = nullptr, *cur = head;',
            'while (cur) {',
            '    Node* nxt = cur->next;',
            '    if (cur->done) {',
            '        (prev ? prev->next : head) = nxt; delete cur;',
            '    } else prev = cur;',
            '    cur = nxt;',
            `}   // unlinked ${removed} node${removed === 1 ? '' : 's'}`,
        ],
    );
    return removed;
}

export function clearTodoList() {
    todoCounter = 0;
    todos.set([]);
}

export function getSnapshotTD() {
    return {
        todos: cloneStoreValue(todos),
        counter: todoCounter,
        codeLog: cloneStoreValue(todoListLog),
        _type: 'todo-list',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotTD>} snapshot
 */
export function applySnapshotTD(snapshot) {
    todoCounter = snapshot.counter ?? 0;
    todos.set(snapshot.todos ?? []);
    if (snapshot.codeLog) todoListLog.set(snapshot.codeLog);
}
