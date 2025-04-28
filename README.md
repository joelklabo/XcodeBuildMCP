<img src="banner.png" alt="XcodeBuild MCP" width="600"/>

A Model Context Protocol (MCP) server that provides Xcode-related tools for integration with AI assistants and other MCP clients.

## Table of contents

- [Table of contents](#table-of-contents)
- [Overview](#overview)
- [Why?](#why)
- [Features](#features)
   * [Xcode project management](#xcode-project-management)
   * [Simulator management](#simulator-management)
   * [App utilities](#app-utilities)
- [Getting started](#getting-started)
   * [Prerequisites](#prerequisites)
   * [One-line setup with mise](#one-line-setup-with-mise)
   * [Configure MCP clients](#configure-mcp-clients)
   * [Enabling UI Automation (beta)](#enabling-ui-automation-beta)
- [Demos](#demos)
   * [Autonomously fixing build errors in Cursor](#autonomously-fixing-build-errors-in-cursor)
   * [Building and running iOS app in Claude Code](#building-and-running-ios-app-in-claude-code)
- [Contributing](#contributing)
   * [Local development setup](#local-development-setup)
      + [Prerequisites](#prerequisites-1)
         - [Optional: Enabling UI Automation](#optional-enabling-ui-automation)
      + [Installation](#installation)
      + [Configure your MCP client](#configure-your-mcp-client)
      + [Debugging](#debugging)
   * [Making changes](#making-changes)
   * [Testing](#testing)
   * [Submitting](#submitting)
- [Licence](#licence)


## Overview

This project implements an MCP server that exposes Xcode operations as tools that can be invoked by AI agents via the MCP protocol. It enables programmatic interaction with Xcode projects through a standardised interface, optimised for agent-driven development workflows.

![xcodebuildmcp2](https://github.com/user-attachments/assets/8961d5db-f7ed-4e60-bbb8-48bfd0bc1353)
<caption>Using Cursor to build, install, and launch an app on the iOS simulator while capturing logs at run-time.</caption>

## Why?

The XcodeBuild MCP tool exists primarily to streamline and standardise interaction between AI agents and Xcode projects. By providing dedicated tools for common Xcode operations, it removes reliance on manual or potentially incorrect command-line invocations.

This ensures a reliable and efficient development process, allowing agents to seamlessly leverage Xcode's capabilities while reducing the risk of configuration errors.

Critically, this MCP enables AI agents to independently validate code changes by building projects, inspecting errors, and iterating autonomously. In contrast to user-driven tools like Sweetpad, XcodeBuild MCP empowers agents to automate these workflows effectively.

## Features

The XcodeBuildMCP server provides the following tool capabilities:

### Xcode project management
- **Discover Projects**: Xcode projects and workspaces discovery
- **Build Operations**: Platform-specific build tools for macOS, iOS simulator, and iOS device targets
- **Project Information**: Tools to list schemes and show build settings for Xcode projects and workspaces
- **Clean Operations**: Clean build products using xcodebuild's native clean action

### Simulator management
- **Simulator Control**: List, boot, and open iOS simulators 
- **App Deployment**: Install and launch apps on iOS simulators
- **Log Capture**: Capture run-time logs from a simulator
- **UI Automation**: Interact with simulator UI elements (beta)
- **Screenshot**: Capture screenshots from a simulator (beta)

### App utilities
- **Bundle ID Extraction**: Extract bundle identifiers from iOS and macOS app bundles
- **App Launching**: Launch built applications on both simulators and macOS

## Getting started

### Prerequisites

- macOS 14.5 or later
- Xcode 16.x or later
- mise

### One-line setup with mise

To install mise:
```bash
# macOS (Homebrew)
brew install mise

# Other installation methods
# See https://mise.jdx.dev/getting-started.html
```

For more information about mise, visit the [official documentation](https://mise.jdx.dev/).

### Configure MCP clients

Configure your MCP client (Windsurf, Cursor, Claude Desktop, etc.) to use the XcodeBuildMCP server by adding the following configuration, changing the version number to match the version you wish to use:

```json
{
  "mcpServers": {
    "XcodeBuildMCP": {
      "command": "mise",
      "args": [
        "x",
        "npm:xcodebuildmcp@1.3.0",
        "--",
        "xcodebuildmcp"
      ]
    }
  }
}
```

> [!NOTE]
> When using mise avoid using the @latest tag as mise will cache the package and may not update to the latest version automatically, instead prefer an explicit version number.

> [!IMPORTANT]
> Please note that XcodeBuildMCP will request xcodebuild to skip macro validation. This is to avoid errors when building projects that use Swift Macros. 

### Enabling UI Automation (beta)

For UI automation features (tap, swipe, screenshot, etc.), you'll need to install Facebook's idb_companion:

```bash
brew tap facebook/fb
brew install idb-companion
```

> [!IMPORTANT]
> Please note that UI automation features are currently in beta so there might be some rough edges. If you encounter any issues, please report them in the [issue tracker](https://github.com/cameroncooke/XcodeBuildMCP/issues).

> [!NOTE]
> Displaying images in tool responses and embedding them in chat context may not be supported by all MCP Clients; it's currently known to be supported in Cursor.

## Demos

### Autonomously fixing build errors in Cursor
![xcodebuildmcp3](https://github.com/user-attachments/assets/173e6450-8743-4379-a76c-de2dd2b678a3)

### Utilising the new UI automation and screen capture features

![xcodebuildmcp4](https://github.com/user-attachments/assets/17300a18-f47a-428a-aad3-dc094859c1b2)

### Building and running iOS app in Claude Code
https://github.com/user-attachments/assets/e3c08d75-8be6-4857-b4d0-9350b26ef086

## Contributing

Contributions are welcome! Here's how you can help improve XcodeBuildMCP.

### Local development setup

#### Prerequisites

In addition to the prerequisites mentioned in the [Getting started](#getting-started) section, you will also need:

- Node.js (v16 or later)
- npm

##### Optional: Enabling UI Automation

When running locally, you'll need to install Facebook's idb tools:

```bash
# Install idb_companion (required for UI automation)
brew tap facebook/fb
brew install idb-companion
```

Install fb-idb Python package:

```bash
pip install fb-idb==1.1.7
```

#### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the project:
   ```
   npm run build
   ```
4. Start the server:
   ```
   node build/index.js
   ```

#### Configure your MCP client

To configure your MCP client to use your local XcodeBuildMCP server you can use the following configuration:

```json
{
  "mcpServers": {
    "XcodeBuildMCP": {
      "command": "node",
      "args": [
        "/path_to/XcodeBuildMCP/build/index.js"
      ]
    }
  }
}
```

#### Debugging

You can use MCP Inspector via:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

### Making changes

1. Fork the repository and create a new branch
2. Follow the TypeScript best practices and existing code style
3. Add proper parameter validation and error handling

### Testing

1. Build the project with `npm run build`
2. Test your changes with MCP Inspector
3. Verify tools work correctly with different MCP clients

### Submitting

1. Run `npm run lint` to check for linting issues (use `npm run lint:fix` to auto-fix)
2. Run `npm run format:check` to verify formatting (use `npm run format` to fix)
3. Update documentation if you've added or modified features
4. Add your changes to the CHANGELOG.md file
5. Push your changes and create a pull request with a clear description
6. Link any related issues

For major changes or new features, please open an issue first to discuss your proposed changes.

## Licence

This project is licensed under the MIT License - see the LICENSE file for details.
