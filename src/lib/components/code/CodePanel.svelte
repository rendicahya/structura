<script>
    const { log } = $props();

    let lang = $state("java");
    let useGenerics = $state(false);
    let fontSize = $state(12.5);
    let codeBodyEl;

    const MIN_FONT_SIZE = 9;
    const MAX_FONT_SIZE = 20;
    function decreaseFontSize() {
        fontSize = Math.max(MIN_FONT_SIZE, fontSize - 1);
    }
    function increaseFontSize() {
        fontSize = Math.min(MAX_FONT_SIZE, fontSize + 1);
    }

    const PROGRAM_WRAP = {
        java: {
            header: ["public class Main {", "    public static void main(String[] args) {"],
            indent: "        ",
            footer: ["    }", "}"],
        },
        cpp: {
            header: ["int main() {"],
            indent: "    ",
            footer: ["    return 0;", "}"],
        },
        python: {
            header: ['if __name__ == "__main__":'],
            indent: "    ",
            footer: [],
        },
    };

    function indentBlock(text, indent) {
        return text
            .split("\n")
            .map((l) => (l.length ? indent + l : l))
            .join("\n");
    }

    function applyGenericsJava(text) {
        return text
            .replace(/\bclass Node \{/g, "class Node<T> {")
            .replace(/\bString data;/g, "T data;")
            .replace(/\bNode (left|right|next|prev);/g, "Node<T> $1;")
            .replace(/\bList<Node> neighbors/g, "List<Node<T>> neighbors")
            .replace(/\bNode (\w+) = new Node/g, "Node<T> $1 = new Node")
            .replace(/\bnew Node\(\)/g, "new Node<>()");
    }

    function applyGenericsCpp(text) {
        return text
            .replace(/\bstruct Node \{/g, "template<typename T>\nstruct Node {")
            .replace(/\bstd::string data;/g, "T data;")
            .replace(/\bNode\*/g, "Node<T>*")
            .replace(/\bnew Node\(/g, "new Node<T>(");
    }

    function applyGenerics(text, language) {
        if (!useGenerics) return text;
        if (language === "java") return applyGenericsJava(text);
        if (language === "cpp") return applyGenericsCpp(text);
        return text;
    }

    // For each line index, is it a foldable block opener, and if so what
    // line index does the block close on. Python is indentation-based
    // (no braces); Java/C++ are brace-based, matched with a stack so
    // nested blocks resolve independently.
    function computeFoldRanges(lines, language) {
        const meta = lines.map(() => ({ foldable: false, endIdx: -1 }));

        if (language === "python") {
            for (let i = 0; i < lines.length; i++) {
                const text = lines[i].text;
                if (text.trim() === "" || !text.trimEnd().endsWith(":")) continue;
                const indent = text.match(/^\s*/)[0].length;
                let end = i;
                for (let j = i + 1; j < lines.length; j++) {
                    const t = lines[j].text;
                    if (t.trim() === "") {
                        end = j;
                        continue;
                    }
                    const ind = t.match(/^\s*/)[0].length;
                    if (ind > indent) end = j;
                    else break;
                }
                if (end > i) {
                    meta[i] = { foldable: true, endIdx: end };
                }
            }
            return meta;
        }

        const stack = [];
        for (let i = 0; i < lines.length; i++) {
            for (const ch of lines[i].text) {
                if (ch === "{") {
                    stack.push(i);
                } else if (ch === "}") {
                    const startIdx = stack.pop();
                    if (startIdx !== undefined && i > startIdx) {
                        meta[startIdx] = { foldable: true, endIdx: i };
                    }
                }
            }
        }
        return meta;
    }

    $effect(() => {
        $log;
        if (codeBodyEl) codeBodyEl.scrollTop = codeBodyEl.scrollHeight;
    });

    const JAVA_KW = new Set([
        "class",
        "new",
        "int",
        "double",
        "String",
        "void",
        "null",
        "this",
        "Node",
        "return",
        "head",
        "tail",
        "walk",
        "do",
        "while",
    ]);

    const PYTHON_KW = new Set([
        "class",
        "def",
        "self",
        "None",
        "True",
        "False",
        "return",
        "import",
        "from",
        "if",
        "else",
        "elif",
        "and",
        "or",
        "not",
        "in",
        "break",
    ]);

    const CPP_KW = new Set([
        "struct",
        "class",
        "new",
        "delete",
        "int",
        "double",
        "string",
        "void",
        "nullptr",
        "this",
        "return",
        "public",
        "private",
        "std",
        "Node",
        "if",
        "else",
        "while",
        "do",
        "for",
        "true",
        "false",
        "auto",
    ]);

    /**
     * @param {string} raw
     * @param {string} language
     */
    function highlight(raw, language) {
        const KW =
            language === "java"
                ? JAVA_KW
                : language === "python"
                  ? PYTHON_KW
                  : CPP_KW;
        const commentChar = language === "python" ? "#" : "//";
        const tokens = [];
        let i = 0;

        while (i < raw.length) {
            if (raw.slice(i, i + commentChar.length) === commentChar) {
                const end = raw.indexOf("\n", i);
                const text = end === -1 ? raw.slice(i) : raw.slice(i, end);
                tokens.push({ type: "comment", text });
                i += text.length;
                continue;
            }

            if (raw[i] === '"') {
                let j = i + 1;
                while (j < raw.length && raw[j] !== '"') j++;
                tokens.push({ type: "string", text: raw.slice(i, j + 1) });
                i = j + 1;
                continue;
            }

            if (raw[i] === "'") {
                let j = i + 1;
                while (j < raw.length && raw[j] !== "'") j++;
                tokens.push({ type: "string", text: raw.slice(i, j + 1) });
                i = j + 1;
                continue;
            }

            if (
                /[0-9]/.test(raw[i]) ||
                (raw[i] === "-" && /[0-9]/.test(raw[i + 1] ?? ""))
            ) {
                let j = i + 1;
                while (j < raw.length && /[0-9.]/.test(raw[j])) j++;
                tokens.push({ type: "number", text: raw.slice(i, j) });
                i = j;
                continue;
            }

            if (/[a-zA-Z_]/.test(raw[i])) {
                let j = i + 1;
                while (j < raw.length && /[a-zA-Z0-9_]/.test(raw[j])) j++;
                const word = raw.slice(i, j);
                tokens.push({
                    type: KW.has(word) ? "keyword" : "ident",
                    text: word,
                });
                i = j;
                continue;
            }

            tokens.push({ type: "plain", text: raw[i] });
            i++;
        }

        function esc(s) {
            return s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        return tokens
            .map((t) => {
                switch (t.type) {
                    case "keyword":
                        return `<span class="kw">${esc(t.text)}</span>`;
                    case "number":
                        return `<span class="num">${esc(t.text)}</span>`;
                    case "string":
                        return `<span class="str">${esc(t.text)}</span>`;
                    case "comment":
                        return `<span class="c">${esc(t.text)}</span>`;
                    default:
                        return esc(t.text);
                }
            })
            .join("");
    }

    function pickLines(entry, language) {
        return language === "java"
            ? entry.java
            : language === "python"
              ? (entry.python ?? entry.java)
              : (entry.cpp ?? entry.java);
    }

    // Class/struct declarations belong at file scope, not nested inside
    // Main's main()/int main() body — detected on the raw (pre-generics)
    // text so the check is unaffected by the generics toggle.
    function isClassEntry(text, language) {
        const trimmed = text.trim();
        return language === "cpp"
            ? /^struct\s+\w+\s*\{/.test(trimmed)
            : /^class\s+\w+/.test(trimmed);
    }

    let flatLines = $derived(
        (() => {
            const wrap = PROGRAM_WRAP[lang];
            let lineNum = 1;
            const result = [];
            const push = (text, fresh) => {
                result.push({ lineNum: lineNum++, text, fresh });
            };

            let hasPreamble = false;
            for (const entry of $log) {
                for (const raw of pickLines(entry, lang)) {
                    if (isClassEntry(raw, lang)) {
                        push(applyGenerics(raw, lang), entry.fresh);
                        hasPreamble = true;
                    }
                }
            }
            if (hasPreamble) push("", false);

            for (const text of wrap.header) push(text, false);

            for (const entry of $log) {
                for (const raw of pickLines(entry, lang)) {
                    if (isClassEntry(raw, lang)) continue;
                    push(indentBlock(applyGenerics(raw, lang), wrap.indent), entry.fresh);
                }
            }

            for (const text of wrap.footer) push(text, false);

            return result;
        })(),
    );

    let fullCode = $derived(flatLines.map((l) => l.text).join("\n"));

    let foldMeta = $derived(computeFoldRanges(flatLines, lang));
    let foldedIdx = $state(new Set());

    $effect(() => {
        lang;
        foldedIdx = new Set();
    });

    function toggleFold(idx) {
        const next = new Set(foldedIdx);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        foldedIdx = next;
    }

    let visibleLines = $derived(
        (() => {
            const result = [];
            let hideUntil = -1;
            for (let i = 0; i < flatLines.length; i++) {
                if (i <= hideUntil) continue;
                const meta = foldMeta[i];
                const folded = meta.foldable && foldedIdx.has(i);
                result.push({ ...flatLines[i], idx: i, foldable: meta.foldable, folded });
                if (folded) hideUntil = meta.endIdx;
            }
            return result;
        })(),
    );

    let copied = $state(false);
    let copyTimer;
    function handleCopy() {
        navigator.clipboard.writeText(fullCode);
        copied = true;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => (copied = false), 2000);
    }
</script>

<div class="code-panel">
    <div class="code-header">
        <div class="lang-tabs">
            <button
                class="lang-tab"
                class:active={lang === "java"}
                onclick={() => (lang = "java")}
            >
                <span class="dot java-dot"></span>Java
            </button>
            <button
                class="lang-tab"
                class:active={lang === "python"}
                onclick={() => (lang = "python")}
            >
                <span class="dot python-dot"></span>Python
            </button>
            <button
                class="lang-tab"
                class:active={lang === "cpp"}
                onclick={() => (lang = "cpp")}
            >
                <span class="dot cpp-dot"></span>C++
            </button>
        </div>
        <div class="header-actions">
            <div class="font-size-control">
                <button
                    class="font-size-btn"
                    onclick={decreaseFontSize}
                    disabled={fontSize <= MIN_FONT_SIZE}
                    title="Decrease code text size"
                >
                    A<span class="font-size-sign">-</span>
                </button>
                <button
                    class="font-size-btn"
                    onclick={increaseFontSize}
                    disabled={fontSize >= MAX_FONT_SIZE}
                    title="Increase code text size"
                >
                    A<span class="font-size-sign">+</span>
                </button>
            </div>
            <button
                class="generics-btn"
                class:active={useGenerics}
                onclick={() => (useGenerics = !useGenerics)}
                title="Toggle generic type parameters (Java/C++)"
                disabled={lang === "python"}
            >
                &lt;T&gt; Generics
            </button>
            <button class="copy-btn" class:copied onclick={handleCopy}>
                {#if copied}
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path
                            d="M2 7L5 10L11 3"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    Copied!
                {:else}
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <rect
                            x="4"
                            y="4"
                            width="7"
                            height="7"
                            rx="1.5"
                            stroke="currentColor"
                            stroke-width="1.3"
                        />
                        <path
                            d="M3 9H2.5A1.5 1.5 0 0 1 1 7.5V2.5A1.5 1.5 0 0 1 2.5 1H7.5A1.5 1.5 0 0 1 9 2.5V3"
                            stroke="currentColor"
                            stroke-width="1.3"
                        />
                    </svg>
                    Copy
                {/if}
            </button>
        </div>
    </div>

    <div class="code-body" bind:this={codeBodyEl} style="--code-font-size: {fontSize}px">
        {#if flatLines.length === 0}
            <div class="empty-code"></div>
        {:else}
            <table class="code-table">
                <tbody>
                    {#each visibleLines as line (line.idx)}
                        <tr class="code-row" class:fresh={line.fresh}>
                            <td class="line-num">{line.lineNum}</td>
                            <td class="fold-gutter">
                                {#if line.foldable}
                                    <button
                                        class="fold-toggle"
                                        class:folded={line.folded}
                                        onclick={() => toggleFold(line.idx)}
                                        title={line.folded ? "Expand" : "Collapse"}
                                        >▸</button
                                    >
                                {/if}
                            </td>
                            <td class="line-code"
                                >{@html highlight(line.text, lang)}{#if line.folded}<span
                                        class="fold-ellipsis">⋯</span
                                    >{/if}</td
                            >
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
</div>

<style>
    .code-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--code-bg);
        overflow: hidden;
    }
    .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px 0;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }
    .lang-tabs {
        display: flex;
        gap: 2px;
    }
    .lang-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-muted);
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        margin-bottom: -1px;
        transition: all 0.15s;
    }
    .lang-tab:hover {
        color: var(--text-dim);
    }
    .lang-tab.active {
        color: var(--text);
        border-bottom-color: var(--accent);
    }
    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .java-dot {
        background: var(--warning);
    }
    .python-dot {
        background: #4b8bbe;
    }
    .cpp-dot {
        background: #00599c;
    }
    .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .font-size-control {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-bottom: 6px;
    }
    .font-size-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface2);
        border: 1px solid var(--border);
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 600;
        width: 24px;
        height: 24px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .font-size-btn:first-child {
        border-radius: 5px 0 0 5px;
    }
    .font-size-btn:last-child {
        border-radius: 0 5px 5px 0;
        border-left: none;
    }
    .font-size-btn .font-size-sign {
        font-size: 9px;
        margin-left: 1px;
    }
    .font-size-btn:hover:not(:disabled) {
        background: var(--border);
        color: var(--text);
    }
    .font-size-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .copy-btn,
    .generics-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 12px;
        padding: 4px 8px;
        cursor: pointer;
        transition: all 0.15s;
        min-width: 70px;
        justify-content: center;
        margin-bottom: 6px;
    }
    .copy-btn:hover,
    .generics-btn:hover:not(:disabled) {
        background: var(--border);
        color: var(--text);
    }
    .generics-btn.active {
        background: rgba(91, 143, 255, 0.14);
        border-color: var(--accent);
        color: var(--accent);
    }
    .generics-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .copy-btn.copied {
        background: rgba(78, 204, 163, 0.12);
        border-color: var(--success);
        color: var(--success);
    }
    .code-body {
        flex: 1;
        overflow: auto;
        padding: 8px 0;
    }
    .empty-code {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-muted);
        font-style: italic;
        padding: 16px 20px;
    }
    .code-table {
        width: 100%;
        border-collapse: collapse;
    }
    .code-row {
        transition: background 0.2s;
    }
    .code-row:hover {
        background: rgba(255, 255, 255, 0.03);
    }
    .code-row.fresh {
        background: rgba(91, 143, 255, 0.1);
        animation: flashIn 0.4s ease;
    }
    @keyframes flashIn {
        from {
            background: rgba(91, 143, 255, 0.28);
        }
        to {
            background: rgba(91, 143, 255, 0.1);
        }
    }
    .line-num {
        width: 40px;
        min-width: 40px;
        text-align: right;
        padding: 1px 12px 1px 8px;
        font-family: var(--font-mono);
        font-size: calc(var(--code-font-size, 12.5px) - 0.5px);
        color: var(--text-muted);
        user-select: none;
        vertical-align: top;
        border-right: 1px solid var(--border);
    }
    .line-code {
        padding: 1px 16px;
        font-family: var(--font-mono);
        font-size: var(--code-font-size, 12.5px);
        line-height: 1.75;
        color: var(--text-dim);
        white-space: pre;
    }
    .fold-gutter {
        width: 14px;
        min-width: 14px;
        padding: 0;
        vertical-align: top;
        border-right: 1px solid var(--border);
    }
    .fold-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: calc(var(--code-font-size, 12.5px) * 1.75 + 2px);
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        color: var(--text-muted);
        font-size: 8px;
        line-height: 1;
        transform: rotate(90deg);
        transition: transform 0.12s, color 0.12s;
    }
    .fold-toggle.folded {
        transform: rotate(0deg);
    }
    .fold-toggle:hover {
        color: var(--text);
    }
    .fold-ellipsis {
        color: var(--text-muted);
        font-style: italic;
        margin-left: 4px;
        user-select: none;
    }
    :global(.kw) {
        color: #c792ea;
        font-weight: 500;
    }
    :global(.num) {
        color: #f78c6c;
    }
    :global(.str) {
        color: #c3e88d;
    }
    :global(.c) {
        color: #546e7a;
        font-style: italic;
    }
</style>
