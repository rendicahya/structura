import { writable, get, derived } from 'svelte/store';
import { logOpPB, phoneBookLog } from '../shared/phoneBookLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a phone's contact book is a hash table with a fixed
 * number of buckets and separate chaining. A name is hashed to a bucket in
 * O(1); contacts that hash to the same bucket share it as a small
 * linked-list "chain". Looking a name up hashes once, then scans only that
 * one chain — never all N contacts. The learner drives it through the
 * contacts UI, never the bucket array directly.
 *
 * @typedef {{ id: string, name: string, phone: string, bucket: number }} Contact
 */

/** Fixed bucket count — small so collisions are easy to trigger and see. */
export const PB_BUCKETS = 8;

/** @type {import('svelte/store').Writable<Contact[]>} insertion order; bucket layout is derived */
export const pbContacts = writable([]);

/**
 * Transient lookup highlight: which bucket was probed, which entry matched
 * (or null), and how many chain links were compared. Cleared after a beat.
 * @type {import('svelte/store').Writable<{ name: string, bucket: number, foundId: string|null, steps: number }|null>}
 */
export const pbLookup = writable(null);

let contactCounter = 0;
let lookupTimer;

export const pbIsEmpty = derived(pbContacts, ($c) => $c.length === 0);
export const pbCount = derived(pbContacts, ($c) => $c.length);

/** Contacts grouped into their buckets, each chain kept in insertion order. */
export const pbBuckets = derived(pbContacts, ($c) => {
    const rows = Array.from({ length: PB_BUCKETS }, () => /** @type {Contact[]} */ ([]));
    for (const c of $c) rows[c.bucket].push(c);
    return rows;
});

/**
 * Sum-of-char-codes hash on the lowercased name — trivial to log and to
 * check by hand. Same scheme as the Hash Table page.
 * @param {string} name
 * @returns {number}
 */
export function bucketOf(name) {
    const key = String(name ?? '').trim().toLowerCase();
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return sum % PB_BUCKETS;
}

function charSum(name) {
    const key = name.trim().toLowerCase();
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return sum;
}

export function initPhoneBook() {
    logOpPB(
        [
            'class Entry { String name, phone; Entry next; }',
            `Entry[] book = new Entry[${PB_BUCKETS}];   // ${PB_BUCKETS} buckets, separate chaining`,
            '',
            'int hash(String name) {',
            '    int sum = 0;',
            '    for (char c : name.toLowerCase().toCharArray()) sum += c;',
            `    return sum % ${PB_BUCKETS};`,
            '}',
        ],
        [
            `book = [[] for _ in range(${PB_BUCKETS})]   # ${PB_BUCKETS} buckets, separate chaining`,
            '',
            'def hash(name):',
            '    return sum(ord(c) for c in name.lower()) % ' + PB_BUCKETS,
        ],
        [
            'struct Entry { std::string name, phone; Entry* next; };',
            `Entry* book[${PB_BUCKETS}] = {nullptr};   // separate chaining`,
            '',
            'int hash(const std::string& name) {',
            '    int sum = 0;',
            '    for (char c : name) sum += std::tolower(c);',
            `    return sum % ${PB_BUCKETS};`,
            '}',
        ],
    );
}

/**
 * Add a contact (or update the number if the name already exists in its
 * bucket). Hashes the name, then appends to that bucket's chain.
 * @param {string} name
 * @param {string} phone
 * @returns {Contact}
 */
export function addContact(name, phone) {
    const nm = String(name ?? '').trim() || 'No name';
    const ph = String(phone ?? '').trim() || '—';
    const bucket = bucketOf(nm);
    const sum = charSum(nm);

    const list = get(pbContacts);
    const existing = list.find((c) => c.bucket === bucket && c.name.toLowerCase() === nm.toLowerCase());

    let contact;
    if (existing) {
        contact = { ...existing, phone: ph };
        pbContacts.set(list.map((c) => (c.id === existing.id ? contact : c)));
    } else {
        contact = { id: `pb_${++contactCounter}`, name: nm, phone: ph, bucket };
        pbContacts.set([...list, contact]);
    }

    const chainLen = get(pbContacts).filter((c) => c.bucket === bucket).length;
    logOpPB(
        [
            `// hash("${nm}") = ${sum} % ${PB_BUCKETS} = ${bucket}`,
            existing
                ? `book[${bucket}] chain: update "${nm}" → ${ph}`
                : chainLen > 1
                  ? `book[${bucket}].append(new Entry("${nm}", "${ph}"));   // collision — chain now ${chainLen} long`
                  : `book[${bucket}] = new Entry("${nm}", "${ph}");   // empty bucket`,
        ],
        [
            `# hash("${nm}") = ${sum} % ${PB_BUCKETS} = ${bucket}`,
            existing
                ? `book[${bucket}]: update "${nm}" -> ${ph}`
                : `book[${bucket}].append(("${nm}", "${ph}"))` +
                  (chainLen > 1 ? `   # collision — chain now ${chainLen} long` : ''),
        ],
        [
            `// hash("${nm}") = ${sum} % ${PB_BUCKETS} = ${bucket}`,
            existing
                ? `book[${bucket}] chain: update "${nm}" -> ${ph}`
                : `// prepend/append Entry{"${nm}", "${ph}"} to book[${bucket}]` +
                  (chainLen > 1 ? `   — chain now ${chainLen} long` : ''),
        ],
    );
    return contact;
}

/**
 * Look a name up: hash to a bucket, then walk that bucket's chain comparing
 * each entry. Pure read — sets the transient highlight, not undoable.
 * @param {string} name
 * @returns {{ bucket: number, foundId: string|null, steps: number }}
 */
export function lookup(name) {
    const nm = String(name ?? '').trim();
    const bucket = bucketOf(nm);
    const sum = charSum(nm || ' ');
    const chain = get(pbContacts).filter((c) => c.bucket === bucket);

    const javaOps = [`// hash("${nm}") = ${sum} % ${PB_BUCKETS} = ${bucket}`, `Entry e = book[${bucket}];`];
    const pyOps = [`# hash("${nm}") = ${sum} % ${PB_BUCKETS} = ${bucket}`];
    const cppOps = [`// hash("${nm}") = ${sum} % ${PB_BUCKETS} = ${bucket}`];

    let foundId = null;
    let steps = 0;
    for (const c of chain) {
        steps++;
        if (c.name.toLowerCase() === nm.toLowerCase()) {
            foundId = c.id;
            javaOps.push(`e.name.equals("${nm}")  →  hit after ${steps} link${steps === 1 ? '' : 's'}: ${c.phone}`);
            pyOps.push(`compare "${c.name}" == "${nm}"  ->  hit after ${steps}: ${c.phone}`);
            cppOps.push(`compare "${c.name}" == "${nm}"  ->  hit after ${steps}: ${c.phone}`);
            break;
        }
        javaOps.push(`e.name.equals("${nm}")? no  →  e = e.next`);
        pyOps.push(`compare "${c.name}" == "${nm}"? no  ->  next link`);
        cppOps.push(`compare "${c.name}" == "${nm}"? no  ->  e = e->next`);
    }
    if (foundId === null) {
        javaOps.push(chain.length === 0 ? 'bucket empty  →  not in book' : `end of chain after ${steps} — not in book`);
        pyOps.push(chain.length === 0 ? 'bucket empty  ->  not found' : `end of chain after ${steps} — not found`);
        cppOps.push(chain.length === 0 ? 'bucket empty  ->  not found' : `end of chain after ${steps} — not found`);
    }

    logOpPB(javaOps, pyOps, cppOps);

    pbLookup.set({ name: nm, bucket, foundId, steps });
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(() => pbLookup.set(null), 2600);

    return { bucket, foundId, steps };
}

/**
 * Remove a contact — unlink it from its bucket's chain.
 * @param {string} id
 */
export function removeContact(id) {
    const list = get(pbContacts);
    const c = list.find((x) => x.id === id);
    if (!c) return false;
    pbContacts.set(list.filter((x) => x.id !== id));
    logOpPB(
        [`// remove "${c.name}" from book[${c.bucket}]`, 'prev.next = e.next;   // or book[b] = e.next if head'],
        [`# remove "${c.name}" from book[${c.bucket}]`, `book[${c.bucket}].remove(("${c.name}", "${c.phone}"))`],
        [`// remove "${c.name}" from book[${c.bucket}]`, 'prev->next = e->next; delete e;'],
    );
    return true;
}

export function clearPhoneBook() {
    contactCounter = 0;
    clearTimeout(lookupTimer);
    pbContacts.set([]);
    pbLookup.set(null);
}

export function getSnapshotPB() {
    return {
        contacts: cloneStoreValue(pbContacts),
        counter: contactCounter,
        codeLog: cloneStoreValue(phoneBookLog),
        _type: 'phone-book',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotPB>} snapshot
 */
export function applySnapshotPB(snapshot) {
    contactCounter = snapshot.counter ?? 0;
    clearTimeout(lookupTimer);
    pbLookup.set(null);
    pbContacts.set(snapshot.contacts ?? []);
    if (snapshot.codeLog) phoneBookLog.set(snapshot.codeLog);
}
