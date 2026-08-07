# Structura 🏗️

**Structura** is an interactive web application that helps students and educators visualize data structures and see the corresponding Java, Python, and C++ code generated in real time. Build a structure visually on the canvas — push, enqueue, insert a node — and watch the exact code for that operation appear on the other side.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte)](https://svelte.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite)](https://vitejs.dev/)

## ✨ Features

- **Seven data structures**: Singly Linked List, Doubly Linked List, Array Stack, Linked-List Stack, Array Queue, Linked-List Queue, and Binary Tree — each with its own canvas and toolbar.
- **Interactive Canvas**: Drag and drop to build structures, right-click to add or edit nodes, and connect pointers by dragging directly from a node's port.
- **Live Code Generation**: Every operation is mirrored instantly as syntax-highlighted **Java**, **Python**, and **C++** code, ready to copy.
- **State Management**:
  - **Undo/Redo**: A full history stack backs every action.
  - **Save/Load**: Export your diagram (and its code log) to JSON and resume later.
- **Smart Tools**:
  - **Auto GC (Garbage Collection)**: Clean up orphaned/unreachable nodes with one click, and see the generated cleanup code.
  - **Traversal Playback**: Step or auto-play in-order/pre-order/post-order traversals on the Binary Tree, with the visited node highlighted live and matching code generated as it goes.
  - **BST Search**: Search for a value with a true comparison-based BST walk — highlights the path node by node, generates the matching search code, and flags found/not-found on the final node.
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

1. **Pick a structure**: Use the tabs at the top to switch between Singly/Doubly Linked List, Array/Linked-List Stack, Array/Linked-List Queue, and Binary Tree.
2. **Add Nodes**: Right-click anywhere on the canvas to add a node at that position, or use the toolbar for structure-specific operations (push, enqueue, insert, ...).
3. **Connect**: Drag from a node's port to another node to link them (drag from the left port for a `prev` pointer on a Doubly Linked List).
4. **Edit Data**: Double-click any node to change its value.
5. **Delete / Manage**: Right-click a node for its context menu, or use the toolbar's GC button to sweep up unreachable nodes.
6. **Pan & Zoom**: Drag the empty canvas to pan, scroll to zoom.
7. **Shortcuts**: Press `?` to open the Keyboard Shortcut Guide.

## 🗺️ Roadmap

All planned data structures (Stack, Queue, Tree) have shipped. Ideas being considered next:
- [x] Binary Search Tree traversal playback (in-order/pre-order/post-order), with play/pause/step controls and matching generated code.
- [x] Binary Search Tree search operation.
- [ ] Additional languages for code generation (e.g. JavaScript, C#).
- [ ] Exporting the canvas as an image (PNG/SVG).
- [ ] Graph structure with BFS/DFS traversal playback.
- [ ] Hash Table structure with collision handling (chaining/open addressing).

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
