import type {
  CreateLocalTracksOptions,
  LocalAudioTrack,
  LocalTrack,
  LocalVideoTrack,
  TrackProcessor,
} from 'livekit-client';
import {
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  facingModeFromLocalTrack,
  Track,
  VideoPresets,
  Mutex,
} from 'livekit-client';
import * as React from 'react';
import { MediaDeviceMenu } from './MediaDeviceMenu';
import { TrackToggle } from '../components/controls/TrackToggle';
import type { LocalUserChoices } from '@livekit/components-core';
import { log } from '@livekit/components-core';
import { ParticipantPlaceholder } from '../assets/images';
import { useMediaDevices, usePersistentUserChoices, useDeviceState } from '../hooks';
import { useWarnAboutMissingStyles } from '../hooks/useWarnAboutMissingStyles';
import { roomOptionsStringifyReplacer } from '../utils';
import { useSelectedDevice } from '../hooks/useSelectedDevice';

/**
 * Enhanced error class that includes device information for better error handling.
 * This extends the original error to preserve all its properties while adding device context.
 * @public
 */
export class DevicePermissionError extends Error {
  public deviceType: 'audio' | 'video';
  public deviceId?: string;

  constructor(originalError: Error, deviceType: 'audio' | 'video', deviceId?: string) {
    // Call the parent Error constructor with the original error's message
    super(originalError.message);

    // Preserve all properties from the original error
    Object.assign(this, originalError);

    // Add our custom properties
    this.deviceType = deviceType;
    this.deviceId = deviceId;
    this.name = 'DevicePermissionError';

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DevicePermissionError.prototype);
  }
}

/**
 * Extended values type that includes both user choices and device availability
 * @public
 */
export type PreJoinValues = LocalUserChoices & {
  audioAvailable: boolean;
  videoAvailable: boolean;
};

/**
 * Props for the PreJoin component.
 * @public
 */
export interface PreJoinProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit' | 'onError'> {
  /** This function is called with the `PreJoinValues` if validation is passed. */
  onSubmit?: (values: PreJoinValues) => void;
  /**
   * Provide your custom validation function. Only if validation is successful the user choices are past to the onSubmit callback.
   */
  onValidate?: (values: PreJoinValues) => boolean;
  /**
   * Called when an error occurs during device setup. The error will be a `DevicePermissionError`
   * that includes information about which device type failed and the original error.
   */
  onError?: (error: DevicePermissionError) => void;
  /** Prefill the input form with initial values. */
  defaults?: Partial<LocalUserChoices>;
  /** Display a debug window for your convenience. */
  debug?: boolean;
  joinLabel?: string;
  micLabel?: string;
  camLabel?: string;
  userLabel?: string;
  /**
   * If true, user choices are persisted across sessions.
   * @defaultValue true
   * @alpha
   */
  persistUserChoices?: boolean;
  videoProcessor?: TrackProcessor<Track.Kind.Video>;
}

/** @public */
export function usePreviewTracks(
  options: CreateLocalTracksOptions,
  onError?: (err: DevicePermissionError) => void,
) {
  const [audioTrack, setAudioTrack] = React.useState<LocalTrack | undefined>();
  const [videoTrack, setVideoTrack] = React.useState<LocalTrack | undefined>();

  const [orphanTracks, setOrphanTracks] = React.useState<Track[]>([]);

  React.useEffect(
    () => () => {
      orphanTracks.forEach((track) => track.stop());
    },
    [orphanTracks],
  );

  const trackLock = React.useMemo(() => new Mutex(), []);

  // Store current tracks in refs to avoid dependency cycles
  const audioTrackRef = React.useRef<LocalTrack | undefined>(audioTrack);
  const videoTrackRef = React.useRef<LocalTrack | undefined>(videoTrack);

  // Update refs when state changes
  React.useEffect(() => {
    audioTrackRef.current = audioTrack;
  }, [audioTrack]);

  React.useEffect(() => {
    videoTrackRef.current = videoTrack;
  }, [videoTrack]);

  // Shared function to handle track creation and cleanup
  const handleTrackCreation = React.useCallback(
    (
      trackType: 'audio' | 'video',
      trackOption: any | false,
      setTrack: React.Dispatch<React.SetStateAction<LocalTrack | undefined>>,
    ) => {
      if (!trackOption) {
        const currentTrack = trackType === 'audio' ? audioTrackRef.current : videoTrackRef.current;

        if (currentTrack) {
          setOrphanTracks((prev) => [...prev, currentTrack]);
          setTrack(undefined);
        }
        return;
      }

      let needsCleanup = false;
      let localTrack: LocalTrack | undefined;

      trackLock.lock().then(async (unlock) => {
        try {
          const trackOptions = {
            audio: trackType === 'audio' ? trackOption : false,
            video: trackType === 'video' ? trackOption : false,
          };

          const tracks = await createLocalTracks(trackOptions);

          localTrack = tracks.find((track) => track.kind === trackType);

          if (needsCleanup && localTrack) {
            localTrack.stop();
          } else if (localTrack) {
            // Stop previous track if it exists
            const currentTrack =
              trackType === 'audio' ? audioTrackRef.current : videoTrackRef.current;

            if (currentTrack) {
              setOrphanTracks((prev) => [...prev, currentTrack]);
            }
            setTrack(localTrack);
          }
        } catch (e: unknown) {
          if (onError && e instanceof Error) {
            // Create enhanced error with device context
            const enhancedError = new DevicePermissionError(e, trackType, trackOption?.deviceId);
            onError(enhancedError);
          } else {
            log.error(e);
          }
        } finally {
          unlock();
        }
      });

      return () => {
        needsCleanup = true;
        if (localTrack) {
          localTrack.stop();
        }
      };
    },
    [trackLock, onError, setOrphanTracks],
  );

  // Handle audio track
  React.useEffect(() => {
    return handleTrackCreation('audio', options.audio, setAudioTrack);
  }, [handleTrackCreation, JSON.stringify(options.audio, roomOptionsStringifyReplacer)]);

  // Handle video track
  React.useEffect(() => {
    return handleTrackCreation('video', options.video, setVideoTrack);
  }, [handleTrackCreation, JSON.stringify(options.video, roomOptionsStringifyReplacer)]);

  // Combine tracks for the return value
  const tracks = React.useMemo(() => {
    const result: LocalTrack[] = [];
    if (audioTrack) result.push(audioTrack);
    if (videoTrack) result.push(videoTrack);
    return result.length > 0 ? result : undefined;
  }, [audioTrack, videoTrack]);

  return tracks;
}
/**
 * @public
 * @deprecated use `usePreviewTracks` instead
 */
export function usePreviewDevice<T extends LocalVideoTrack | LocalAudioTrack>(
  enabled: boolean,
  deviceId: string,
  kind: 'videoinput' | 'audioinput',
) {
  const [deviceError, setDeviceError] = React.useState<DevicePermissionError | null>(null);
  const [isCreatingTrack, setIsCreatingTrack] = React.useState<boolean>(false);

  const devices = useMediaDevices({ kind });
  const [selectedDevice, setSelectedDevice] = React.useState<MediaDeviceInfo | undefined>(
    undefined,
  );

  const [localTrack, setLocalTrack] = React.useState<T>();
  const [localDeviceId, setLocalDeviceId] = React.useState<string>(deviceId);

  React.useEffect(() => {
    setLocalDeviceId(deviceId);
  }, [deviceId]);

  const createTrack = async (deviceId: string, kind: 'videoinput' | 'audioinput') => {
    try {
      const track =
        kind === 'videoinput'
          ? await createLocalVideoTrack({
              deviceId,
              resolution: VideoPresets.h720.resolution,
            })
          : await createLocalAudioTrack({ deviceId });

      const newDeviceId = await track.getDeviceId(false);
      if (newDeviceId && deviceId !== newDeviceId) {
        prevDeviceId.current = newDeviceId;
        setLocalDeviceId(newDeviceId);
      }
      setLocalTrack(track as T);
    } catch (e) {
      if (e instanceof Error) {
        // Create enhanced error with device context
        const enhancedError = new DevicePermissionError(
          e,
          kind === 'videoinput' ? 'video' : 'audio',
          deviceId,
        );
        setDeviceError(enhancedError);
      }
    }
  };

  const switchDevice = async (track: LocalVideoTrack | LocalAudioTrack, id: string) => {
    await track.setDeviceId(id);
    prevDeviceId.current = id;
  };

  const prevDeviceId = React.useRef(localDeviceId);

  React.useEffect(() => {
    if (!isCreatingTrack && enabled && !localTrack && !deviceError) {
      log.debug('creating track', kind);
      setIsCreatingTrack(true);
      createTrack(localDeviceId, kind).finally(() => {
        setIsCreatingTrack(false);
      });
    }
  }, [enabled, localTrack, deviceError, isCreatingTrack]);

  // switch camera device
  React.useEffect(() => {
    if (!localTrack) {
      return;
    }
    if (!enabled) {
      log.debug(`muting ${kind} track`);
      localTrack.mute().then(() => log.debug(localTrack.mediaStreamTrack));
    } else if (selectedDevice?.deviceId && prevDeviceId.current !== selectedDevice?.deviceId) {
      log.debug(`switching ${kind} device from`, prevDeviceId.current, selectedDevice.deviceId);
      switchDevice(localTrack, selectedDevice.deviceId);
    } else {
      log.debug(`unmuting local ${kind} track`);
      localTrack.unmute();
    }
  }, [localTrack, selectedDevice, enabled, kind]);

  React.useEffect(() => {
    return () => {
      if (localTrack) {
        log.debug(`stopping local ${kind} track`);
        localTrack.stop();
        localTrack.mute();
      }
    };
  }, []);

  React.useEffect(() => {
    setSelectedDevice(devices?.find((dev) => dev.deviceId === localDeviceId));
  }, [localDeviceId, devices]);

  return {
    selectedDevice,
    localTrack,
    deviceError,
  };
}

/**
 * The `PreJoin` prefab component is normally presented to the user before he enters a room.
 * This component allows the user to check and select the preferred media device (camera und microphone).
 * On submit the user decisions are returned, which can then be passed on to the `LiveKitRoom` so that the user enters the room with the correct media devices.
 *
 * @remarks
 * This component is independent of the `LiveKitRoom` component and should not be nested within it.
 * Because it only accesses the local media tracks this component is self-contained and works without connection to the LiveKit server.
 *
 * @example
 * ```tsx
 * <PreJoin />
 * ```
 * @public
 */
export function PreJoin({
  defaults = {},
  onValidate,
  onSubmit,
  onError,
  debug,
  joinLabel = 'Join Room',
  micLabel = 'Microphone',
  camLabel = 'Camera',
  userLabel = 'Username',
  persistUserChoices = true,
  videoProcessor,
  ...htmlProps
}: PreJoinProps) {
  const {
    userChoices: initialUserChoices,
    saveAudioInputDeviceId,
    saveAudioInputEnabled,
    saveVideoInputDeviceId,
    saveVideoInputEnabled,
    saveUsername,
  } = usePersistentUserChoices({
    defaults,
    preventSave: !persistUserChoices,
    preventLoad: !persistUserChoices,
  });

  // Get real-time device state
  const { deviceStatus, isDeviceAvailable } = useDeviceState();

  const [userChoices, setUserChoices] = React.useState(initialUserChoices);

  // Initialize device settings
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(userChoices.audioEnabled);
  const [videoEnabled, setVideoEnabled] = React.useState<boolean>(userChoices.videoEnabled);
  const [audioDeviceId, setAudioDeviceId] = React.useState<string>(userChoices.audioDeviceId);
  const [videoDeviceId, setVideoDeviceId] = React.useState<string>(userChoices.videoDeviceId);
  const [username, setUsername] = React.useState(userChoices.username);

  // Automatically disable devices that aren't available
  React.useEffect(() => {
    if (!isDeviceAvailable('audio') && audioEnabled) {
      setAudioEnabled(false);
    }
  }, [isDeviceAvailable, audioEnabled]);

  React.useEffect(() => {
    if (!isDeviceAvailable('video') && videoEnabled) {
      setVideoEnabled(false);
    }
  }, [isDeviceAvailable, videoEnabled]);

  // Save user choices to persistent storage.
  React.useEffect(() => {
    saveAudioInputEnabled(audioEnabled);
  }, [audioEnabled, saveAudioInputEnabled]);
  React.useEffect(() => {
    saveVideoInputEnabled(videoEnabled);
  }, [videoEnabled, saveVideoInputEnabled]);
  React.useEffect(() => {
    saveAudioInputDeviceId(audioDeviceId);
  }, [audioDeviceId, saveAudioInputDeviceId]);
  React.useEffect(() => {
    saveVideoInputDeviceId(videoDeviceId);
  }, [videoDeviceId, saveVideoInputDeviceId]);
  React.useEffect(() => {
    saveUsername(username);
  }, [username, saveUsername]);

  const tracks = usePreviewTracks(
    {
      audio:
        audioEnabled && isDeviceAvailable('audio')
          ? { deviceId: initialUserChoices.audioDeviceId }
          : false,
      video:
        videoEnabled && isDeviceAvailable('video')
          ? { deviceId: initialUserChoices.videoDeviceId, processor: videoProcessor }
          : false,
    },
    onError,
  );

  const videoEl = React.useRef(null);

  const videoTrack = React.useMemo(
    () => tracks?.filter((track) => track.kind === Track.Kind.Video)[0] as LocalVideoTrack,
    [tracks],
  );

  const facingMode = React.useMemo(() => {
    if (videoTrack) {
      const { facingMode } = facingModeFromLocalTrack(videoTrack);
      return facingMode;
    } else {
      return 'undefined';
    }
  }, [videoTrack]);

  const audioTrack = React.useMemo(
    () => tracks?.filter((track) => track.kind === Track.Kind.Audio)[0] as LocalAudioTrack,
    [tracks],
  );

  const { selectedDevice: selectedAudioDevice } = useSelectedDevice({
    kind: 'audioinput',
    track: audioTrack,
    deviceId: audioDeviceId,
  });
  const { selectedDevice: selectedVideoDevice } = useSelectedDevice({
    kind: 'videoinput',
    track: videoTrack,
    deviceId: videoDeviceId,
  });

  React.useEffect(() => {
    if (videoEl.current && videoTrack) {
      videoTrack.unmute();
      videoTrack.attach(videoEl.current);
    }

    return () => {
      if (videoTrack) {
        if (videoEl.current) videoTrack.detach(videoEl.current);
        videoTrack.stop();
      }
    };
  }, [videoTrack]);

  const [isValid, setIsValid] = React.useState<boolean>();

  const handleValidation = React.useCallback(
    (values: LocalUserChoices) => {
      const extendedValues: PreJoinValues = {
        ...values,
        audioAvailable: isDeviceAvailable('audio'),
        videoAvailable: isDeviceAvailable('video'),
      };

      if (typeof onValidate === 'function') {
        return onValidate(extendedValues);
      } else {
        return values.username !== '';
      }
    },
    [onValidate, isDeviceAvailable],
  );

  React.useEffect(() => {
    const newUserChoices = {
      username,
      videoEnabled,
      videoDeviceId,
      audioEnabled,
      audioDeviceId,
      deviceStatus,
    };
    setUserChoices(newUserChoices);
    setIsValid(handleValidation(newUserChoices));
  }, [
    username,
    videoEnabled,
    handleValidation,
    audioEnabled,
    audioDeviceId,
    videoDeviceId,
    deviceStatus,
  ]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (handleValidation(userChoices)) {
      if (typeof onSubmit === 'function') {
        const extendedValues: PreJoinValues = {
          ...userChoices,
          audioAvailable: isDeviceAvailable('audio'),
          videoAvailable: isDeviceAvailable('video'),
        };
        onSubmit(extendedValues);
      }
    } else {
      log.warn('Validation failed with: ', userChoices);
    }
  }

  useWarnAboutMissingStyles();

  return (
    <div className="lk-prejoin" {...htmlProps}>
      <div className="lk-video-container">
        {videoTrack && (
          <video ref={videoEl} width="1280" height="720" data-lk-facing-mode={facingMode} />
        )}
        {(!videoTrack || !videoEnabled) && (
          <div className="lk-camera-off-note">
            <ParticipantPlaceholder />
          </div>
        )}
      </div>
      <div className="lk-button-group-container">
        <div className="lk-button-group-pre-join audio">
          <TrackToggle
            initialState={audioEnabled}
            source={Track.Source.Microphone}
            onChange={(enabled) => setAudioEnabled(enabled)}
          />
          <div className="lk-button-group-menu-pre-join">
            <label className="lk-selected-device-label">
              {selectedAudioDevice?.label || micLabel}
            </label>
          </div>
          <MediaDeviceMenu
            initialSelection={audioDeviceId}
            kind="audioinput"
            disabled={Boolean(!selectedAudioDevice) || !isDeviceAvailable('audio')}
            tracks={{ audioinput: audioTrack }}
            onActiveDeviceChange={(_, id) => setAudioDeviceId(id)}
          />
        </div>
        <div className="lk-button-group-pre-join video">
          <TrackToggle
            initialState={videoEnabled}
            source={Track.Source.Camera}
            onChange={(enabled) => setVideoEnabled(enabled)}
          />
          <div className="lk-button-group-menu-pre-join">
            <label className="lk-selected-device-label">
              {selectedVideoDevice?.label || camLabel}
            </label>
          </div>
          <MediaDeviceMenu
            initialSelection={videoDeviceId}
            kind="videoinput"
            disabled={Boolean(!selectedAudioDevice) || !isDeviceAvailable('video')}
            tracks={{ videoinput: videoTrack }}
            onActiveDeviceChange={(_, id) => setVideoDeviceId(id)}
          />
        </div>
      </div>

      <form className="lk-username-container">
        <input
          className="lk-form-control"
          id="username"
          name="username"
          type="text"
          defaultValue={username}
          placeholder={userLabel}
          onChange={(inputEl) => setUsername(inputEl.target.value)}
          autoComplete="off"
        />
        <button
          className="lk-button lk-join-button"
          type="submit"
          onClick={handleSubmit}
          disabled={!isValid}
        >
          {joinLabel}
        </button>
      </form>

      {debug && (
        <>
          <strong>User Choices:</strong>
          <ul className="lk-list" style={{ overflow: 'hidden', maxWidth: '15rem' }}>
            <li>Username: {`${userChoices.username}`}</li>
            <li>Video Enabled: {`${userChoices.videoEnabled}`}</li>
            <li>Audio Enabled: {`${userChoices.audioEnabled}`}</li>
            <li>Video Device: {`${userChoices.videoDeviceId}`}</li>
            <li>Audio Device: {`${userChoices.audioDeviceId}`}</li>
            <li>Audio Status: {`${deviceStatus.audio}`}</li>
            <li>Video Status: {`${deviceStatus.video}`}</li>
          </ul>
        </>
      )}
    </div>
  );
}
