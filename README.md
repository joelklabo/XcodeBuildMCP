<img src="banner.png" alt="XcodeBuild MCP" width="600"/>

A Model Context Protocol (MCP) server that provides Xcode-related tools for integration with AI assistants and other MCP clients.

## Overview

This project implements an MCP server that exposes Xcode operations as tools that can be invoked by MCP clients. It allows AI assistants or other tools to interact with Xcode projects programmatically through a standardised interface.

## Why?

The XcodeBuild MCP tool exists to streamline and standardise the interaction between AI assistants and Xcode projects. By providing a set of dedicated tools that expose common Xcode operations, it eliminates the reliance on potentially outdated or incorrect command-line invocations. 

This ensures a more reliable and efficient development process, enabling MCP clients to leverage the full capabilities of Xcode seamlessly and without the risk of configuration errors. 


## Features

The XcodeBuildMCP server provides the following tools:

### Build tools
- **build**: Builds the project using xcodebuild with support for workspaces, projects, schemes, and various platforms (iOS, macOS, watchOS, tvOS, visionOS and their simulator variants).
- **showBuildSettings**: Shows build settings for the project using xcodebuild.
- **getAppPath**: Extracts the app bundle path from build settings, making it easier to find the built app for installation or launching.
- **listSchemes**: Lists all available schemes in an Xcode project or workspace.
- **clean**: Cleans build products using xcodebuild's native clean action.

### Simulator tools
- **listSimulators**: Lists available iOS simulators with their UUIDs.
- **bootSimulator**: Boots an iOS simulator using a specified UUID.
- **openSimulator**: Opens the iOS Simulator app to view the simulator UI.
- **installAppInSimulator**: Installs an app in an iOS simulator.
- **launchAppInSimulator**: Launches an app in an iOS simulator using its bundle ID.

### macOS tools

- **launchMacOSApp**: Launches a macOS app using the open command.

### Bundle ID tools
- **getBundleId**: Extracts the bundle identifier from an app bundle (.app).
- **getiOSBundleId**: Extracts the bundle identifier from an iOS app bundle.
- **getMacOSBundleId**: Extracts the bundle identifier from a macOS app bundle.

## Getting started

### Prerequisites

- Node.js (v16 or later)
- npm
- Xcode command-line tools

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the project:
   ```
   npm run build
   ```
4. Optionally start the server:
   ```
   node build/index.js
   ```

> [!NOTE]
> You don't need to run the server manually as MCP clients will do this for you.

## Adding to Windsurf/Cursor/Clude Desktop etc.

Create a new custom server configuration and add the following; changing the path to the actual path you cloned the repo to.

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

## Debugging

You can use MCP Inspector via:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Licence

This project is licensed under the MIT License - see the LICENSE file for details.
