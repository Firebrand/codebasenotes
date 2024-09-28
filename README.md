# CodebaseNotes

An extension that allows you to add notes about your codebase's files AND folders directly on the project tree in the VS Code UI. The aim is to help developers and teams maintain clear documentation about the structure and purpose of different parts of their codebase. Also serves as a great tool for personal learning or onboarding. All notes are stored into a single json file that can be checked into a repo.

![CodebaseNotes Demo](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/demo2.gif)

## Features

- **Project Tree View**: A custom tree view in the sidebar that displays your codebase's structure.
- **File and Folder Annotations**: Add annotations to files and folders directly within VS Code.
- **Gitignore Integration**: Automatically respects your project's `.gitignore` file.
- **Auto-save**: Annotations are automatically saved as you type.
- **File bundles**: Add relative path chunks to your notes to open multiple files simultaneously

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "CodebaseNotes"
4. Click Install

## Usage

### Viewing the Project Tree

1. After installation, you'll see a new "CodebaseNotes" icon in the Activity Bar.
2. Click on it to open the Project Tree view.

### Adding/Editing Annotations

1. In the Project Tree view, click on a file or folder.
2. The Annotation Editor will open, allowing you to add or edit the annotation.
3. Type your annotation in the text area.
4. The annotation will auto-save as you type.
5. In your annotation, enclose a relative path to a file in square brackets (ex. [src/app/index.js]). Whenever you click on the current file (the one that has the annotation), the referenced file will also open!

### Opening Files

- Clicking on a file in the Project Tree will open it in the editor and allow you to edit its annotation.
- Everytime you click on a file/folder in the Project Tree, any open files you have in the Editor will close. This is intentional.

### Commands

- `CodebaseNotes: Open File and Edit Annotation`: Opens a file and allows you to edit its annotation.
- `CodebaseNotes: Edit Folder Annotation`: Allows you to edit a folder's annotation.

## Configuration

You can configure CodebaseNotes through VS Code's settings:

- `projectdoc.autoSave`: Enable/disable auto-saving of annotations (default: true)

## File Storage

Annotations are stored in a `.codebasenotes-annotations.json` file in your codebase root. This file can be committed to version control to share annotations with your team.

## Requirements

- Visual Studio Code version 1.74.0 or higher

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any suggestions, please [open an issue](https://github.com/Firebrand/codebasenotes/issues) on our GitHub repository.

---

Happy coding with CodebaseNotes! 🗺️👨‍💻👩‍💻