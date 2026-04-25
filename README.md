# Structura 🏗️

**Structura** is a powerful, interactive web application designed to help students and educators visualize data structures and generate corresponding code in real-time. Built with a focus on simplicity and educational value, it allows you to build complex diagrams visually and see the implementation logic instantly.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte)](https://svelte.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite)](https://vitejs.dev/)

## ✨ Features

- **Interactive Canvas**: Seamlessly drag and drop nodes to build your data structures.
- **Dual Support**: Full support for both **Singly Linked Lists** and **Doubly Linked Lists**.
- **Live Code Generation**: Instantly view and copy code in **Java** and **Python** as you modify your diagram.
- **State Management**:
  - **Undo/Redo**: Never worry about mistakes with a robust history system.
  - **Save/Load**: Export your work to JSON and resume later.
- **Smart Tools**:
  - **Auto GC (Garbage Collection)**: Clean up orphaned nodes with one click.
  - **Zoom & Pan**: Navigate through large structures with ease.
- **User Experience**:
  - **Keyboard Shortcuts**: Power-user friendly with a built-in shortcut guide.
  - **Toast Notifications**: Real-time feedback for all your actions.
  - **Responsive Splitter**: Customizable workspace for coding and designing.

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

1. **Add Nodes**: Right-click anywhere on the canvas.
2. **Connect**: Click a source node, then click a target node to create a link.
3. **Edit Data**: Double-click any node to change its value.
4. **Delete**: Use the context menu (right-click) or keyboard shortcuts.
5. **Shortcuts**: Press `?` to open the Keyboard Shortcut Guide.

## 🗺️ Roadmap

Future plans for **Structura** include supporting more data structures:
- [ ] **Stack** visualization and code generation.
- [ ] **Queue** visualization and code generation.
- [ ] **Tree** (Binary Search Tree, AVL, etc.) visualization.

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
