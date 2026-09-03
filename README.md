# Structura 🏗️

**Structura** is an interactive web application that helps students and educators visualize data structures and see the corresponding Java, Python, and C++ code generated in real time. Build a structure visually on the canvas — push, enqueue, insert a node — and watch the exact code for that operation appear on the other side.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte)](https://svelte.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite)](https://vitejs.dev/)

## ✨ Features

- **Fourteen data structures**: Singly Linked List, Doubly Linked List, Circular Linked List, Doubly Circular Linked List, Array Stack, Linked-List Stack, Array Queue, Linked-List Queue, Binary Tree, Binary Search Tree, AVL Tree, Heap / Priority Queue, Hash Table, and Graph — each with its own canvas and toolbar.
- **Interactive Canvas**: Drag and drop to build structures, right-click to add or edit nodes, and connect pointers by dragging directly from a node's port.
- **Live Code Generation**: Every operation is mirrored instantly as syntax-highlighted **Java**, **Python**, and **C++** code, ready to copy.
- **State Management**:
  - **Undo/Redo**: A full history stack backs every action.
  - **Save/Load**: Export your diagram (and its code log) to JSON and resume later.
- **Smart Tools**:
  - **Auto GC (Garbage Collection)**: Clean up orphaned/unreachable nodes with one click, and see the generated cleanup code.
  - **Traversal Playback**: Step or auto-play in-order/pre-order/post-order traversals on the Binary Tree, with the visited node highlighted live and matching code generated as it goes.
  - **BST Search**: Search for a value with a true comparison-based BST walk — highlights the path node by node, generates the matching search code, and flags found/not-found on the final node.
  - **Graph BFS/DFS Playback**: Pick a start node and step or auto-play a breadth-first or depth-first traversal over directed edges, with the same live-highlight and code-generation treatment as the Tree.
  - **Binary Search Tree**: A dedicated BST page with rule-enforced, comparison-driven insertion and a standard leaf/one-child/two-child (in-order successor) delete — unlike the free-placement Binary Tree page, in-order traversal on this page always yields sorted output.
  - **Heap / Priority Queue**: An array-backed binary heap (min or max mode, chosen at creation) visualized as a complete binary tree with an array-index badge on every node. Insert sifts up and Extract Root sifts down with a step-by-step comparison trail in the generated code, and repeated extraction always yields values in sorted (ascending for min, descending for max) order.
  - **AVL Tree**: A self-balancing BST that automatically applies single or double rotations after every insert/delete to keep the tree height-balanced, with a live balance-factor badge on every node and the rotation logic itself shown in the generated code.
  - **Hash Table (separate chaining)**: A fixed-bucket-count table using a simple sum-of-char-codes hash function, with each bucket rendered as a small linked-list "chain" of colliding entries. Buckets with more than one entry are flagged with a collision badge and warning border, and Search walks the target bucket's chain live, logging each comparison and highlighting the found entry (or flashing not-found).
  - **Circular Linked List Ring Traversal**: Play a full lap around the ring from the head, highlighting each node in turn and generating the matching do-while traversal code.
  - **Doubly Circular Linked List**: Every node carries both `next` and `prev` back into a closed ring; Insert/Delete Head & Tail keep both link directions consistent (tail deletion is a single `prev` hop, no walk), plus forward and backward ring-traversal playback.
  - **Infix ↔ Postfix on the Array Stack**: Convert an infix expression to postfix, or evaluate a postfix expression, with the current token and running output/result shown live as the array stack fills and drains.
  - **Zoom & Pan**: Mouse-relative zoom and free panning for large structures.
  - **Batch Operations**: Enqueue/push multiple values at once via comma-separated input.
- **User Experience**:
  - **Light / Dark Theme**.
  - **Keyboard Shortcuts**: Built-in shortcut guide (press `?`).
  - **Toast Notifications**: Real-time feedback for every action.
  - **Resizable Split View**: Drag the divider to balance canvas vs. code space, or hide the code panel entirely.

## 🚀 Getting Started

### Online Version
You can access the live version at: [rendicahya.github.io/structura](https://rendicahya.github.io/structura/)

### Local Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/rendicahya/structura.git
   cd structura
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start development server**:
   ```bash
   npm run dev
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```

## 🛠️ Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS
- **Icons**: Custom SVG

## 📖 How to Use

1. **Pick a structure**: Use the tabs at the top to switch between Singly/Doubly/Circular/Doubly Circular Linked List, Array/Linked-List Stack, Array/Linked-List Queue, Binary Tree, Binary Search Tree, AVL Tree, Heap / Priority Queue, Hash Table, and Graph.
2. **Add Nodes**: Right-click anywhere on the canvas to add a node at that position, or use the toolbar for structure-specific operations (push, enqueue, insert, ...).
3. **Connect**: Drag from a node's port to another node to link them (drag from the left port for a `prev` pointer on a Doubly Linked List).
4. **Edit Data**: Double-click any node to change its value (disabled on the Binary Search Tree and AVL Tree pages, where a value's position is derived from comparisons — use Insert/Delete instead).
5. **Delete / Manage**: Right-click a node for its context menu, or use the toolbar's GC button to sweep up unreachable nodes.
6. **Pan & Zoom**: Drag the empty canvas to pan, scroll to zoom.
7. **Shortcuts**: Press `?` to open the Keyboard Shortcut Guide.

## 🗺️ Roadmap

All planned data structures (Stack, Queue, Tree) have shipped. Ideas being considered next:
- [x] Binary Search Tree traversal playback (in-order/pre-order/post-order), with play/pause/step controls and matching generated code.
- [x] Binary Search Tree search operation.
- [ ] Additional languages for code generation (e.g. JavaScript, C#).
- [ ] Exporting the canvas as an image (PNG/SVG).
- [x] Graph structure with BFS/DFS traversal playback.
- [x] Circular Linked List, with Insert/Delete Head & Tail and a ring-traversal playback that generates the matching do-while code.
- [x] Doubly Circular Linked List, with Insert/Delete Head & Tail that maintain both link directions and forward/backward ring-traversal playback.
- [x] Infix-to-postfix conversion and postfix evaluation as an Array Stack mode, with playback controls and matching generated code.
- [x] Binary Search Tree with rule-enforced insert (comparison-driven placement, duplicates rejected) and standard delete (leaf / one-child / two-child in-order-successor).
- [x] Heap Tree with array-backed insert/extract-root (min or max mode), doubling as a Priority Queue enqueue/dequeue.
- [x] AVL Tree with automatic rebalancing (single and double rotations) after insert and delete.
- [x] Hash Table with separate chaining, a sum-of-char-codes hash function, and a chain-walking Search.

### Coverage against a typical Data Structures & Algorithms syllabus

Structura's structures were checked against a standard ASD (Algoritma & Struktur Data) course outline covering linear structures, trees, graphs, searching, and hashing. Gaps identified, roughly in priority order:

| Topic | Status |
|---|---|
| Array, singly/doubly/circular linked list | ✅ covered |
| Stack & Queue (array and linked-list backed) | ✅ covered |
| Stack application: postfix/infix expression evaluation | ✅ covered |
| Priority Queue (basic and heap-backed) | ✅ covered |
| Binary Tree traversal/search (free node placement) | ✅ covered |
| Binary Search Tree insert/delete/traversal/search (rule-enforced ordering) | ✅ covered |
| Complete Binary Tree | ✅ covered |
| Heap Tree (min/max-heap, heapify) | ✅ covered — insert/extract-root only, no bulk build-heapify from an existing array |
| AVL Tree (rotations/rebalancing) | ✅ covered |
| Graph ADT (adjacency list/matrix) + BFS/DFS | ⚠️ BFS/DFS playback covered; adjacency list/matrix representation isn't shown |
| Linear search (array/list/queue/linked list) | ❌ not yet |
| Binary search (sorted array) | ❌ not yet |
| Hashing (hash functions, collision handling) | ✅ covered — separate chaining; open addressing not implemented |

Contributions targeting any of the ❌ items are especially welcome.

## 🤝 Contributing

Contributions make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---
Developed with ❤️ by [Randy Cahya Wihandika](https://github.com/rendicahya)
