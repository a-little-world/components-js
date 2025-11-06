# LiveKitRoom Permission Handling

This document describes how permission denied errors are handled in the LiveKitRoom component.

## Overview

The `LiveKitRoom` component now provides enhanced error handling for permission denied scenarios when accessing audio and video devices. Instead of adding separate callbacks for each permission type, the existing `onError` callback receives enriched error objects that allow you to distinguish between different types of permission failures.

## How It Works

When a permission is denied for audio or video devices:

1. The error is detected using cross-browser compatible detection logic
2. The error is wrapped in a `DevicePermissionError` object that includes:
   - All original error properties
   - `deviceType`: either `'audio'` or `'video'`
   - `deviceId`: the device ID if available
3. The wrapped error is passed to the `onError` callback

Regular errors that are not permission-related are passed to `onError` unchanged.

## Usage

```typescript
import { LiveKitRoom, DevicePermissionError } from '@livekit/components-react';

<LiveKitRoom
  serverUrl={serverUrl}
  token={token}
  audio={true}
  video={true}
  onError={(error) => {
    // Check if it's a permission error
    if (error instanceof DevicePermissionError) {
      // Handle based on device type
      if (error.deviceType === 'audio') {
        console.error('Microphone permission denied');
        // Show microphone-specific help
      } else if (error.deviceType === 'video') {
        console.error('Camera permission denied');
        // Show camera-specific help
      }
    } else {
      // Handle other errors
      console.error('Other error:', error);
    }
  }}
>
  {/* Your room components */}
</LiveKitRoom>
```

## DevicePermissionError API

```typescript
class DevicePermissionError extends Error {
  deviceType: 'audio' | 'video';
  deviceId?: string;
  
  constructor(originalError: Error, deviceType: 'audio' | 'video', deviceId?: string);
}
```

### Properties

- **`deviceType`**: Indicates which type of device failed - `'audio'` for microphone, `'video'` for camera
- **`deviceId`**: The ID of the specific device that failed (if available)
- All original error properties are preserved (message, name, stack, etc.)

## Permission Detection

The implementation detects permission denied errors across different browsers by checking for:

- Error names containing: `notallowed`, `permissiondenied`, `security`
- Error messages containing: `permission denied`, `denied by system`, `blocked`

This works reliably across Chrome, Firefox, Safari, and Edge.

## Error Handling Behavior

- **Granular handling**: Each device type (audio, video, screen) is enabled separately
- **Non-blocking**: If one device fails, others can still succeed
- **Consistent**: Uses `Promise.allSettled()` to ensure all devices are attempted
- **Backward compatible**: Existing error handling code continues to work

## Example Use Cases

1. **Show browser-specific instructions**
   ```typescript
   if (error instanceof DevicePermissionError) {
     showPermissionModal(error.deviceType, userBrowser);
   }
   ```

2. **Track analytics**
   ```typescript
   if (error instanceof DevicePermissionError) {
     analytics.track('permission_denied', {
       deviceType: error.deviceType,
       deviceId: error.deviceId,
     });
   }
   ```

3. **Provide alternatives**
   ```typescript
   if (error instanceof DevicePermissionError && error.deviceType === 'video') {
     // Allow joining with audio only
     setAudioOnlyMode(true);
   }
   ```

## Migration Guide

If you're currently using basic error handling:

**Before:**
```typescript
<LiveKitRoom
  onError={(error) => {
    console.error('Error:', error);
  }}
/>
```

**After (enhanced):**
```typescript
<LiveKitRoom
  onError={(error) => {
    if (error instanceof DevicePermissionError) {
      // Handle permission errors specifically
      handlePermissionError(error.deviceType);
    } else {
      // Handle other errors
      console.error('Error:', error);
    }
  }}
/>
```

No breaking changes - existing code continues to work as before.

## See Also

- `examples/nextjs/pages/livekit-room-permission-test.tsx` - Comprehensive test page
- `examples/nextjs/pages/permission-handling-example.tsx` - Simple usage example
- `packages/react/src/prefabs/PreJoin.tsx` - PreJoin component uses the same pattern

