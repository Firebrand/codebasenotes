# CodebaseNotes

A VS Code extension that allows you to annotate your codebase's files AND folders directly on a project tree in the VS Code UI. The goal is to help developers and teams maintain clear documentation about the structure and purpose of different parts of their codebase. Also serves as a great tool for onboarding or just personal learning. All notes are stored into a single json file that can be checked into a repo.

![CodebaseNotes Demo](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/demo5.gif)

## Usage

### Accessing CodebaseNotes

- You can access CodebaseNotes by clicking on the "CodebaseNotes" icon in the Activity Bar.
- Alternatively, use the keyboard shortcut:
  - Windows/Linux: `Ctrl+Alt+C`
  - macOS: `Cmd+Option+C`

### Click on a file or folder and enter an annotation for it (it's autosaved)

![Tutorial 1](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/1.png)

### Put a number in front of your annotation to have it ordered by that in the annotation list

![Tutorial 2](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/2.png)

### Right-click on a file, choose "Copy Relative Path" and paste that into an annotation. Whenever this annotation is opened, it will also open the referenced file.

![Tutorial 3](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/3.png)

### Your annotations are stored in a `.codebasenotes-annotations.json` file in your project's root directory. This file can be checked into a repo to share annotations with your team.

![Tutorial 4](https://raw.githubusercontent.com/Firebrand/codebasenotes/main/resources/4.png)

## Requirements

- Visual Studio Code version 1.74.0 or higher

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any suggestions, please [open an issue](https://github.com/Firebrand/codebasenotes/issues) on our GitHub repository.

---

Happy coding with CodebaseNotes! 📝👨‍💻👩‍💻
