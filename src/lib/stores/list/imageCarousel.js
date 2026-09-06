import { writable, get, derived } from 'svelte/store';
import { logOpIC, imageCarouselLog } from '../shared/imageCarouselLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: an image carousel modelled as a *doubly circular* linked
 * list of slides. Every slide points to `next` and `prev`; the last slide's
 * `next` loops to `head` and `head.prev` loops to the tail. So "Next" past
 * the last slide and "Prev" before the first both wrap for free — one hop,
 * no bounds check, no modulo. A `current` pointer marks the visible slide.
 *
 * Adding a slide links it at the tail and re-closes both rings. Removing one
 * unlinks it and stitches both neighbours together.
 *
 * The visual order lives in a plain array; the doubly-circular structure is
 * what the generated Java/Python/C++ shows.
 *
 * @typedef {{ id: string, caption: string, hue: number }} Slide
 */

/** @type {import('svelte/store').Writable<Slide[]>} head → tail order */
export const slides = writable([]);

/** @type {import('svelte/store').Writable<string|null>} the visible slide */
export const currentSlideId = writable(null);

let slideCounter = 0;

export const icIsEmpty = derived(slides, ($s) => $s.length === 0);
export const icCount = derived(slides, ($s) => $s.length);
export const currentSlideIndex = derived(
    [slides, currentSlideId],
    ([$s, $c]) => $s.findIndex((x) => x.id === $c),
);
export const currentSlide = derived(
    [slides, currentSlideId],
    ([$s, $c]) => $s.find((x) => x.id === $c) ?? null,
);

/**
 * @param {string} caption
 * @returns {Slide}
 */
function makeSlide(caption) {
    slideCounter += 1;
    return {
        id: `slide_${slideCounter}`,
        caption: String(caption ?? '').trim() || `Slide ${slideCounter}`,
        // Spread hues around the wheel so consecutive slides read as distinct.
        hue: (slideCounter * 47) % 360,
    };
}

export function initImageCarousel() {
    logOpIC(
        [
            'class Slide {',
            '    String caption;',
            '    Slide prev, next;   // ring: tail.next == head, head.prev == tail',
            '}',
            'Slide head, current;',
        ],
        [
            'class Slide:',
            '    def __init__(self, caption):',
            '        self.caption = caption',
            '        self.prev = self.next = None   # ring, both ways',
            '',
            'head = current = None',
        ],
        [
            'struct Slide {',
            '    std::string caption;',
            '    Slide *prev = nullptr, *next = nullptr;   // ring, both ways',
            '};',
            'Slide *head = nullptr, *current = nullptr;',
        ],
    );
}

/**
 * Link a new slide at the tail and re-close both rings.
 * @param {string} caption
 * @returns {Slide}
 */
export function addSlide(caption) {
    const s = makeSlide(caption);
    const list = get(slides);
    slides.set([...list, s]);
    const first = list.length === 0;
    if (first) currentSlideId.set(s.id);

    logOpIC(
        first
            ? [`Slide s = new Slide("${s.caption}");`, 's.next = s.prev = s;', 'head = current = s;   // 1-slide ring']
            : [
                  `Slide s = new Slide("${s.caption}");`,
                  'Slide tail = head.prev;',
                  's.prev = tail; s.next = head;',
                  'tail.next = s; head.prev = s;   // re-close both rings',
              ],
        first
            ? [`s = Slide("${s.caption}")`, 's.next = s.prev = s', 'head = current = s   # 1-slide ring']
            : [
                  `s = Slide("${s.caption}")`,
                  'tail = head.prev',
                  's.prev, s.next = tail, head',
                  'tail.next = head.prev = s   # re-close both rings',
              ],
        first
            ? [`Slide* s = new Slide{"${s.caption}"};`, 's->next = s->prev = s;', 'head = current = s;   // 1-slide ring']
            : [
                  `Slide* s = new Slide{"${s.caption}"};`,
                  'Slide* tail = head->prev;',
                  's->prev = tail; s->next = head;',
                  'tail->next = s; head->prev = s;   // re-close both rings',
              ],
    );
    return s;
}

/** ▶ — one hop along `next`; from the last slide this wraps to `head`. */
export function nextSlide() {
    const list = get(slides);
    const idx = list.findIndex((x) => x.id === get(currentSlideId));
    if (idx < 0 || list.length === 0) return false;
    const wrapped = idx === list.length - 1;
    currentSlideId.set(list[(idx + 1) % list.length].id);

    logOpIC(
        wrapped ? ['current = current.next;   // tail.next == head → wraps to first'] : ['current = current.next;'],
        wrapped ? ['current = current.next   # tail.next is head → wraps to first'] : ['current = current.next'],
        wrapped ? ['current = current->next;   // tail->next == head → wraps to first'] : ['current = current->next;'],
    );
    return true;
}

/** ◀ — one hop along `prev`; from the first slide this wraps to the tail. */
export function prevSlide() {
    const list = get(slides);
    const idx = list.findIndex((x) => x.id === get(currentSlideId));
    if (idx < 0 || list.length === 0) return false;
    const wrapped = idx === 0;
    currentSlideId.set(list[(idx - 1 + list.length) % list.length].id);

    logOpIC(
        wrapped ? ['current = current.prev;   // head.prev == tail → wraps to last'] : ['current = current.prev;'],
        wrapped ? ['current = current.prev   # head.prev is tail → wraps to last'] : ['current = current.prev'],
        wrapped ? ['current = current->prev;   // head->prev == tail → wraps to last'] : ['current = current->prev;'],
    );
    return true;
}

/**
 * Jump straight to a tapped thumbnail.
 * @param {string} id
 */
export function goToSlide(id) {
    const list = get(slides);
    const from = get(currentSlideIndex);
    const to = list.findIndex((x) => x.id === id);
    if (to < 0 || to === from) return false;
    currentSlideId.set(id);

    const dir = to > from ? 'next' : 'prev';
    logOpIC(
        [`while (current != target) current = current.${dir};`],
        [`while current is not target:\n    current = current.${dir}`],
        [`while (current != target) current = current->${dir};`],
    );
    return true;
}

/**
 * Unlink a slide and stitch its two neighbours together.
 * @param {string} id
 */
export function removeSlide(id) {
    const list = get(slides);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return false;

    const removed = list[idx];
    const wasCurrent = get(currentSlideId) === id;
    const next = list.filter((x) => x.id !== id);
    slides.set(next);

    if (next.length === 0) currentSlideId.set(null);
    else if (wasCurrent) currentSlideId.set((list[idx + 1] ?? list[0]).id);

    logOpIC(
        [
            `// remove "${removed.caption}"`,
            'node.prev.next = node.next;',
            'node.next.prev = node.prev;   // both neighbours re-linked',
            idx === 0 ? 'head = node.next;' : '// head unchanged',
            wasCurrent ? 'current = node.next;' : '// current unchanged',
        ],
        [
            `# remove "${removed.caption}"`,
            'node.prev.next = node.next',
            'node.next.prev = node.prev   # both neighbours re-linked',
            idx === 0 ? 'head = node.next' : '# head unchanged',
            wasCurrent ? 'current = node.next' : '# current unchanged',
        ],
        [
            `// remove "${removed.caption}"`,
            'node->prev->next = node->next;',
            'node->next->prev = node->prev;   // both neighbours re-linked',
            idx === 0 ? 'head = node->next;' : '// head unchanged',
            wasCurrent ? 'current = node->next;' : '// current unchanged',
        ],
    );
    return true;
}

export function clearImageCarousel() {
    slideCounter = 0;
    slides.set([]);
    currentSlideId.set(null);
}

export function getSnapshotIC() {
    return {
        slides: cloneStoreValue(slides),
        currentSlideId: get(currentSlideId),
        counter: slideCounter,
        codeLog: cloneStoreValue(imageCarouselLog),
        _type: 'image-carousel',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotIC>} snapshot
 */
export function applySnapshotIC(snapshot) {
    slideCounter = snapshot.counter ?? 0;
    slides.set(snapshot.slides ?? []);
    currentSlideId.set(snapshot.currentSlideId ?? null);
    if (snapshot.codeLog) imageCarouselLog.set(snapshot.codeLog);
}
