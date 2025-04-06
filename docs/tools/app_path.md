# App Path Tools

This document describes the app path retrieval tools available in XcodeBuildMCP.

## Tools Overview

### macOS App Path Tools

- `get_macos_app_path_workspace` - Gets the app bundle path for a macOS application using a workspace
- `get_macos_app_path_project` - Gets the app bundle path for a macOS application using a project file

### iOS Device App Path Tools

- `get_ios_device_app_path_workspace` - Gets the app bundle path for an iOS device application using a workspace
- `get_ios_device_app_path_project` - Gets the app bundle path for an iOS device application using a project file

### Simulator App Path Tools

- `get_simulator_app_path_by_name_workspace` - Gets the app bundle path for a simulator by name using a workspace
- `get_simulator_app_path_by_name_project` - Gets the app bundle path for a simulator by name using a project file
- `get_simulator_app_path_by_id_workspace` - Gets the app bundle path for a simulator by UUID using a workspace
- `get_simulator_app_path_by_id_project` - Gets the app bundle path for a simulator by UUID using a project file

## Usage Examples

### Getting App Path for macOS

```javascript
// Using a workspace
get_macos_app_path_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme'
})

// Using a project file
get_macos_app_path_project({
  projectPath: '/path/to/MyProject.xcodeproj',
  scheme: 'MyScheme'
})
```

### Getting App Path for iOS Device

```javascript
// Using a workspace
get_ios_device_app_path_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme'
})

// Using a project file
get_ios_device_app_path_project({
  projectPath: '/path/to/MyProject.xcodeproj',
  scheme: 'MyScheme'
})
```

### Getting App Path for a Simulator

```javascript
// By name with a workspace
get_simulator_app_path_by_name_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme',
  platform: 'iOS Simulator',
  simulatorName: 'iPhone 16'
})

// By UUID with a project file
get_simulator_app_path_by_id_project({
  projectPath: '/path/to/MyProject.xcodeproj',
  scheme: 'MyScheme',
  platform: 'iOS Simulator',
  simulatorId: 'SIMULATOR_UUID'
})
```

## Parameters

### macOS and iOS Device Tool Parameters

| Parameter | Type | Description | Required | Default |
|-----------|------|-------------|----------|---------|
| `workspacePath` | string | Path to the .xcworkspace file | Yes (for workspace tools) | - |
| `projectPath` | string | Path to the .xcodeproj file | Yes (for project tools) | - |
| `scheme` | string | The scheme to get app path for | Yes | - |
| `configuration` | string | Build configuration (Debug, Release, etc.) | No | "Debug" |

### Simulator Tool Parameters

| Parameter | Type | Description | Required | Default |
|-----------|------|-------------|----------|---------|
| `workspacePath` | string | Path to the .xcworkspace file | Yes (for workspace tools) | - |
| `projectPath` | string | Path to the .xcodeproj file | Yes (for project tools) | - |
| `scheme` | string | The scheme to get app path for | Yes | - |
| `configuration` | string | Build configuration (Debug, Release, etc.) | No | "Debug" |
| `platform` | string | The target simulator platform (iOS Simulator, watchOS Simulator, etc.) | Yes | - |
| `simulatorName` | string | Name of the simulator to use (e.g., 'iPhone 16') | Yes (for name-based tools) | - |
| `simulatorId` | string | UUID of the simulator to use (obtained from list_simulators) | Yes (for ID-based tools) | - |
| `useLatestOS` | boolean | Whether to use the latest OS version for the named simulator | No | true |
