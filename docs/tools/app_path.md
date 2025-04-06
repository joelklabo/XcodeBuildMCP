# App Path Tools

This document describes the app path retrieval tools available in XcodeBuildMCP. These tools help you locate the built app bundles after a successful build, enabling further actions like installation or launching.

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

// Using a project file with specific configuration
get_macos_app_path_project({
  projectPath: '/path/to/MyProject.xcodeproj',
  scheme: 'MyScheme',
  configuration: 'Release'
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

// Using a specific OS version rather than latest
get_simulator_app_path_by_name_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme',
  platform: 'iOS Simulator',
  simulatorName: 'iPhone 16',
  useLatestOS: false
})
```

## Complete Workflow Examples

### Building and Running a macOS App

```javascript
// First, build the app
macos_build_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme'
})

// Then get the app path
const appPathResult = get_macos_app_path_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme'
})
// Extract app path from result
const appPath = extractPathFromResult(appPathResult)

// Get the bundle ID
const bundleIdResult = get_macos_bundle_id({
  appPath: appPath
})
// Extract bundle ID from result
const bundleId = extractBundleIdFromResult(bundleIdResult)

// Launch the app
launch_macos_app({
  appPath: appPath
})
```

### Building and Running an iOS Simulator App

```javascript
// First, list available simulators
const simulatorsResult = list_simulators({})
// From result, find desired simulator ID
const simulatorId = findDesiredSimulatorId(simulatorsResult)

// Build for that simulator
ios_simulator_build_by_id_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme',
  simulatorId: simulatorId
})

// Get the app path
const appPathResult = get_simulator_app_path_by_id_workspace({
  workspacePath: '/path/to/MyProject.xcworkspace',
  scheme: 'MyScheme',
  platform: 'iOS Simulator',
  simulatorId: simulatorId
})
// Extract app path from result
const appPath = extractPathFromResult(appPathResult)

// Get the bundle ID
const bundleIdResult = get_ios_bundle_id({
  appPath: appPath
})
// Extract bundle ID from result
const bundleId = extractBundleIdFromResult(bundleIdResult)

// Boot the simulator
boot_simulator({
  simulatorUuid: simulatorId
})

// Install the app
install_app_in_simulator({
  simulatorUuid: simulatorId,
  appPath: appPath
})

// Launch the app
launch_app_in_simulator({
  simulatorUuid: simulatorId,
  bundleId: bundleId
})
```

## Error Handling

### Common Error Scenarios

1. **App Not Built:** If you try to get the app path before building the app, the tool will fail with a message indicating it couldn't find the app. Always build the app first.

   ```javascript
   // This will fail if MyScheme hasn't been built
   get_macos_app_path_workspace({
     workspacePath: '/path/to/MyProject.xcworkspace',
     scheme: 'MyScheme'
   })
   
   // Ensure you build first
   macos_build_workspace({
     workspacePath: '/path/to/MyProject.xcworkspace',
     scheme: 'MyScheme'
   })
   ```

2. **Invalid Scheme:** If you provide a scheme that doesn't exist, the tool will fail. Use the list_schemes tools to check available schemes first.

   ```javascript
   // First check available schemes
   list_schemes_workspace({
     workspacePath: '/path/to/MyProject.xcworkspace'
   })
   ```

3. **Invalid Simulator:** For simulator tools, make sure the simulator exists. List simulators first to verify.

   ```javascript
   // Check available simulators
   list_simulators({})
   ```

4. **Invalid Configuration:** If you specify a configuration that doesn't exist, the tool will fail. Default configurations are typically 'Debug' and 'Release'.

### Troubleshooting Tips

- If the app path tool fails, check that the app was built successfully
- Verify the scheme name with list_schemes tools
- For simulators, ensure the simulator exists and is available
- Check that paths are absolute and correctly formatted
- For workspace/project paths, ensure they point to the .xcworkspace or .xcodeproj files, not just the directory

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

## Return Value

On success, these tools return an object with the app path and suggested next steps. For example:

```javascript
{
  content: [
    {
      type: 'text',
      text: '✅ App path retrieved successfully: /path/to/build/MyApp.app'
    },
    {
      type: 'text',
      text: 'Next Steps:\n1. Get bundle ID: get_macos_bundle_id({ appPath: "/path/to/build/MyApp.app" })\n2. Launch the app: launch_macos_app({ appPath: "/path/to/build/MyApp.app" })'
    }
  ]
}
```
