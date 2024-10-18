# CodebaseNotes

A VS Code extension that allows you to add notes about your codebase's files AND folders directly on a project tree in the VS Code UI. The goal is to help developers and teams maintain clear documentation about the structure and purpose of different parts of their codebase. Also serves as a great tool for onboarding or just personal learning. All notes are stored into a single json file that can be checked into a repo.

![CodebaseNotes Demo](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/demo4.gif)

## Features

- **Project Tree View**: A custom sidebar view that displays your project structure, respecting `.gitignore` rules.
- **File and Folder Annotations**: Add notes to both files and folders directly in VS Code.
- **Annotation Editor**: A dedicated webview for editing annotations with auto-save functionality.
- **Smart File Bundling**: Reference related files in your annotations to open them simultaneously.
- **Gitignore Integration**: Automatically respects your project's `.gitignore` file to exclude irrelevant files and folders.
- **Real-time Updates**: The project tree updates in real-time as you make changes to your files or annotations.
- **Reveal in CodebaseNotes**: Quickly locate and reveal files in the CodebaseNotes tree view.

## Installation

1. Open Visual Studio Code
2. Navigate to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
3. Search for "CodebaseNotes"
4. Click Install

## Usage

### Viewing the Project Tree

1. After installation, you'll see a new "CodebaseNotes" icon in the Activity Bar.
2. Click on it to open the Project Tree view, which displays your project structure.

### Adding/Editing Annotations

1. In the Project Tree view, click on a file or folder.
2. The Annotation Editor will open in the sidebar, allowing you to add or edit the annotation.
3. Type your annotation in the text area. It will auto-save as you type.
4. To reference other files, enclose their relative paths in square brackets (e.g., `[src/app/index.js]`). Clicking on the annotated file will also open these referenced files.

### Opening Files

- Clicking on a file in the Project Tree will open it in the editor and allow you to edit its annotation.
- When you click on a file/folder in the Project Tree, any previously open files in the Editor will close. This is by design to keep your workspace focused.

### Commands

CodebaseNotes adds the following commands to VS Code:

- `CodebaseNotes: Open File and Edit Annotation`: Opens a file and allows you to edit its annotation.
- `CodebaseNotes: Edit Folder Annotation`: Allows you to edit a folder's annotation.
- `CodebaseNotes: Refresh Project Tree`: Manually refreshes the project tree view.
- `CodebaseNotes: Copy Relative Path`: Copies the relative path of a file or folder, formatted for use in annotations.
- `CodebaseNotes: Reveal in CodebaseNotes`: Reveals the current file in the CodebaseNotes tree view.

## Configuration

You can configure CodebaseNotes through VS Code's settings:

- `codebaseNotes.autoSave`: Enable/disable auto-saving of annotations (default: true)

## File Storage

Annotations are stored in a `.codebasenotes-annotations.json` file in your project's root directory. This file can be committed to version control to share annotations with your team.

## Requirements

- Visual Studio Code version 1.74.0 or higher

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any suggestions, please [open an issue](https://github.com/Firebrand/codebasenotes/issues) on our GitHub repository.

---

Happy coding with CodebaseNotes! 📝👨‍💻👩‍💻