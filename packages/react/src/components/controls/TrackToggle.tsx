import type { CaptureOptionsBySource, ToggleSource } from '@livekit/components-core';
import * as React from 'react';
import { getSourceIcon } from '../../assets/icons/util';
import { useTrackToggle } from '../../hooks';
import type { TrackPublishOptions } from 'livekit-client';

/** @public */
export interface TrackToggleProps<T extends ToggleSource>
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  source: T;
  showIcon?: boolean;
  initialState?: boolean;
  /** When true, renders a disabled-style toggle that indicates permissions are denied. */
  permissionDenied?: boolean;
  /**
   * Function that is called when the enabled state of the toggle changes.
   * The second function argument `isUserInitiated` is `true` if the change was initiated by a user interaction, such as a click.
   */
  onChange?: (enabled: boolean, isUserInitiated: boolean) => void;
  captureOptions?: CaptureOptionsBySource<T>;
  publishOptions?: TrackPublishOptions;
  onDeviceError?: (error: Error) => void;
}

/**
 * With the `TrackToggle` component it is possible to mute and unmute your camera and microphone.
 * The component uses an html button element under the hood so you can treat it like a button.
 *
 * @example
 * ```tsx
 * <LiveKitRoom>
 *   <TrackToggle source={Track.Source.Microphone} />
 *   <TrackToggle source={Track.Source.Camera} />
 * </LiveKitRoom>
 * ```
 * @public
 */
function TrackToggleEnabled<T extends ToggleSource>(
  { showIcon, ...props }: TrackToggleProps<T>,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const { buttonProps, enabled } = useTrackToggle(props);
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient) return null;
  return (
    <button ref={ref} {...buttonProps}>
      {(showIcon ?? true) && getSourceIcon(props.source, enabled)}
      {props.children}
    </button>
  );
}

const TrackToggleEnabledForward = React.forwardRef(TrackToggleEnabled) as <T extends ToggleSource>(
  props: TrackToggleProps<T> & React.RefAttributes<HTMLButtonElement>,
) => React.ReactElement | null;

export const TrackToggle = React.forwardRef(function Wrapper<T extends ToggleSource>(
  { permissionDenied, showIcon, ...props }: TrackToggleProps<T>,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  if (permissionDenied) {
    return (
      <button
        ref={ref}
        aria-pressed={false}
        data-lk-source={props.source}
        className={`lk-permission-denied lk-button`.trim()}
        onClick={props.onClick}
        type={props.type}
        disabled={props.disabled}
      >
        {(showIcon ?? true) && getSourceIcon(props.source, false)}
        {props.children}
      </button>
    );
  }
  return <TrackToggleEnabledForward showIcon={showIcon} {...props} ref={ref} />;
}) as <T extends ToggleSource>(
  props: TrackToggleProps<T> & React.RefAttributes<HTMLButtonElement>,
) => React.ReactElement | null;
