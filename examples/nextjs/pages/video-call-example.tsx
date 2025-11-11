import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  GridLayout,
  TrackToggle,
  MediaDeviceMenu,
  useDisconnectButton,
  PermissionsModal,
  useTrackToggle,
  DevicePermissionError,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { LocalParticipant, Track } from 'livekit-client';
import { useEffect, useState } from 'react';

interface CallData {
  uuid: string;
  token: string;
  livekitServerUrl: string;
  audioOptions: { echoCancellation: boolean; noiseSuppression: boolean };
  videoOptions: { resolution: { width: number; height: number } };
}

const TOGGLE_BACKGROUND = '#6d6d6d';

const gridLayoutStyles = `
  .permission-denied-toggle {
    border-radius: 24px 0 0 24px;
    height: 44px;
  }

  .custom-grid-layout {
    --lk-row-count: 1 !important;
    --lk-col-count: 1 !important;
  }

  .custom-grid-layout .lk-participant-tile[data-lk-local-participant='true'] {
    position: absolute !important;
    top: 72px;
    right: 12px;
    width: 30%;
    max-height: 50%;
    z-index: 1;
    border-radius: 8px;
    aspect-ratio: 9 / 16;
  }

  @media (min-width: 640px) {
    .custom-grid-layout .lk-participant-tile[data-lk-local-participant='true'] {
      aspect-ratio: 16 / 9;
      width: 25%;
    }
  }

  @media (min-width: 1024px) {
    .custom-grid-layout .lk-participant-tile[data-lk-local-participant='true'] {
      top: 12px;
      width: 20%;
    }
  }

  .custom-grid-layout .lk-participant-tile[data-lk-local-participant='true'] .lk-participant-metadata-item:first-child {
    display: none;
  }

  .custom-grid-layout .lk-participant-tile[data-lk-local-participant='true'] .lk-participant-metadata {
    justify-content: flex-end;
  }

  .custom-grid-layout .lk-participant-placeholder {
    padding: 2px;
    background: #2d3748;
    border-radius: 0;
  }

  .custom-grid-layout .lk-participant-placeholder svg {
    padding: 0;
  }

  .custom-grid-layout .lk-participant-tile[data-lk-video-muted='true'] {
    background: #4a5568;
  }

  .custom-grid-layout .lk-participant-tile[data-lk-video-muted='true'] svg {
    max-height: 320px;
  }

  .custom-grid-layout .lk-participant-metadata-item {
    background: transparent;
    color: white;
    opacity: 1;
  }

  .custom-grid-layout .lk-participant-tile[data-lk-video-muted='true'] .lk-participant-metadata-item {
    color: #a0aec0;
  }

  .custom-grid-layout .lk-participant-tile[data-lk-local-participant='false'] .lk-participant-metadata {
    justify-content: flex-start;
    top: 80px;
    left: 12px;
    right: 0;
    bottom: unset;
  }

  @media (min-width: 1024px) {
    .custom-grid-layout .lk-participant-tile[data-lk-local-participant='false'] .lk-participant-metadata {
      top: 12px;
    }
  }

  .custom-grid-layout .lk-participant-tile[data-lk-local-participant='false'] .lk-participant-placeholder {
    background: #4a5568;
  }

  .custom-grid-layout video {
    object-fit: contain !important;
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('custom-grid-styles')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'custom-grid-styles';
  styleTag.textContent = gridLayoutStyles;
  document.head.appendChild(styleTag);
}

const barStyle: React.CSSProperties = {
  width: '100%',
  position: 'absolute',
  bottom: 0,
  left: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'nowrap',
  padding: '12px',
  gap: '8px',
  overflow: 'visible',
  zIndex: 10,
};

const mediaControlStyle: React.CSSProperties = {
  background: TOGGLE_BACKGROUND,
  color: 'white',
  borderColor: TOGGLE_BACKGROUND,
  borderRadius: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  height: '44px',
  position: 'relative',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const disconnectBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '24px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  height: '44px',
};

function ControlBar({
  onPermissionModalOpen,
}: {
  onPermissionModalOpen?: (permissions: { audio: boolean; video: boolean }) => void;
}) {
  const { buttonProps: disconnectProps } = useDisconnectButton({});
  const { permissionDenied: audioPermissionDenied } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const { permissionDenied: videoPermissionDenied } = useTrackToggle({
    source: Track.Source.Camera,
  });

  const handleOpenPermissionModal = () => {
    onPermissionModalOpen?.({ audio: audioPermissionDenied, video: videoPermissionDenied });
  };

  const getMediaControlStyle = (permissionDenied: boolean): React.CSSProperties => ({
    ...mediaControlStyle,
    ...(permissionDenied && {
      background: '#ea4335',
      borderColor: '#ea4335',
    }),
  });

  return (
    <div style={barStyle}>
      <div style={getMediaControlStyle(audioPermissionDenied)}>
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon
          onClick={audioPermissionDenied ? handleOpenPermissionModal : undefined}
          className={audioPermissionDenied ? 'permission-denied-toggle' : undefined}
        />
        <MediaDeviceMenu kind="audioinput" />
      </div>
      <div style={getMediaControlStyle(videoPermissionDenied)}>
        <TrackToggle
          source={Track.Source.Camera}
          showIcon
          onClick={videoPermissionDenied ? handleOpenPermissionModal : undefined}
          className={videoPermissionDenied ? 'permission-denied-toggle' : undefined}
        />
        <MediaDeviceMenu kind="videoinput" />
      </div>
      <div style={sectionStyle}>
        <button {...disconnectProps} style={disconnectBtnStyle}>
          Leave Call
        </button>
      </div>
    </div>
  );
}

function ProfileImage({
  label,
  size = 'medium',
  circle = false,
}: {
  label?: string;
  size?: 'small' | 'medium' | 'large' | 'flex';
  circle?: boolean;
}) {
  const sizes = {
    small: '40px',
    medium: '80px',
    large: '120px',
    flex: '100%',
  };

  return (
    <div
      style={{
        width: sizes[size],
        height: sizes[size],
        borderRadius: circle ? '50%' : '8px',
        overflow: 'hidden',
        backgroundColor: '#4a5568',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size === 'small' ? '16px' : size === 'medium' ? '32px' : '48px',
        fontWeight: 'bold',
      }}
    >
      {label || '👤'}
    </div>
  );
}

function Text({ children, type = 'body' }: { children: React.ReactNode; type?: 'body' | 'body4' }) {
  const styles: Record<string, React.CSSProperties> = {
    body: { fontSize: '14px', fontWeight: 'normal' },
    body4: { fontSize: '16px', fontWeight: 'normal' },
  };

  return <p style={{ margin: 0, ...styles[type] }}>{children}</p>;
}

function VideoPlaceholder({
  label,
  size = 'medium',
  circle = false,
}: {
  label?: string;
  size?: 'small' | 'medium' | 'large' | 'flex';
  circle?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
      }}
    >
      <ProfileImage label={label} size={size} circle={circle} />
    </div>
  );
}

const videosStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
  position: 'relative',
};

const waitingTileStyle: React.CSSProperties = {
  color: 'white',
  background: 'black',
  height: '100%',
  width: '100%',
  position: 'absolute',
  top: 0,
  left: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '12px',
  padding: '48px 32px',
  borderRadius: '8px',
};

function MyVideoConference({
  partnerLabel,
  partnerName,
  selfLabel,
  onPermissionModalOpen,
}: {
  partnerLabel?: string;
  partnerName?: string;
  selfLabel?: string;
  onPermissionModalOpen?: (permissions: { audio: boolean; video: boolean }) => void;
}) {
  // `useTracks` returns all camera and screen share tracks. If a user
  // joins without a published camera track, a placeholder track is returned.
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: true, // Include local participant's video
  });
  const [currentParticipants, setCurrentParticipants] = useState(1);
  const [otherUserDisconnected, setOtherUserDisconnected] = useState(false);

  useEffect(() => {
    if (tracks.length === 1 && currentParticipants > 1) setOtherUserDisconnected(true);
    setCurrentParticipants(tracks.length);
  }, [tracks.length, currentParticipants]);

  const placeholders: Record<string, React.ReactNode> = {};
  tracks.forEach((track) => {
    if (track.participant) {
      const isLocal = track?.participant instanceof LocalParticipant;

      placeholders[track.participant.identity] = (
        <VideoPlaceholder circle label={isLocal ? selfLabel : partnerLabel} size="flex" />
      );
    }
  });

  if (!tracks || tracks?.length === 0) return null;

  return (
    <div style={videosStyle}>
      <GridLayout tracks={tracks} style={{ height: '100%' }} className="custom-grid-layout">
        <ParticipantTile placeholders={placeholders} />
      </GridLayout>

      {tracks.length === 1 && (
        <div style={waitingTileStyle}>
          <ProfileImage circle label={partnerLabel} size="medium" />
          <Text type="body4">
            {otherUserDisconnected
              ? `${partnerName || 'Participant'} disconnected`
              : `Waiting for ${partnerName || 'other participant'}...`}
          </Text>
        </div>
      )}

      <ControlBar onPermissionModalOpen={onPermissionModalOpen} />
    </div>
  );
}

// Mock profile data
const profile = {
  label: 'Y',
  name: 'You',
};

const partnerProfile = {
  label: 'P',
  name: 'Partner',
};

function VideoCallExample() {
  // Mock call data - replace with your actual data
  const [callData, setCallData] = useState<CallData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [deniedPermissions, setDeniedPermissions] = useState<{
    audio: boolean;
    video: boolean;
  }>({ audio: false, video: false });

  // Initialize call data on client side to avoid hydration errors
  useEffect(() => {
    setCallData({
      uuid: 'test-room-' + Date.now(),
      token: process?.env?.NEXT_PUBLIC_LIVEKIT_TOKEN || '',
      livekitServerUrl: process?.env?.NEXT_PUBLIC_LK_SERVER_URL || '',
      audioOptions: { echoCancellation: true, noiseSuppression: true },
      videoOptions: { resolution: { width: 1280, height: 720 } },
    });
  }, []);

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  const handleConnected = () => {
    setIsConnected(true);
  };

  const handleError = (err: Error) => {
    setError(err.message);
    if (err instanceof DevicePermissionError) {
      // Merge the new error with existing permissions instead of replacing
      setDeniedPermissions((prev) => ({
        ...prev,
        audio: err.deviceType === 'audio' ? true : prev.audio,
        video: err.deviceType === 'video' ? true : prev.video,
      }));
      setShowPermissionModal(true);
    }
  };

  if (!callData) {
    return (
      <div
        style={{
          padding: '20px',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: 'black',
          borderRadius: '8px',
          color: 'white',
        }}
      >
        <h1 style={{ margin: '0 0 10px 0', color: 'white' }}>Video Call Example</h1>
        <p style={{ margin: '0 0 10px 0', color: 'white' }}>
          <strong>Status:</strong>{' '}
          <span style={{ color: isConnected ? '#4ade80' : '#fb923c' }}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </p>
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#9ca3af' }}>
          Room: {callData?.uuid || 'Loading...'}
        </p>
        {error && (
          <div
            style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#d1d5db' }}>
          <p style={{ margin: '5px 0' }}>
            <strong>Audio Options:</strong> {JSON.stringify(callData?.audioOptions || {})}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>Video Options:</strong> {JSON.stringify(callData?.videoOptions || {})}
          </p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: '#000',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          minHeight: '500px',
        }}
      >
        <LiveKitRoom
          video={callData?.videoOptions || false}
          audio={callData?.audioOptions || false}
          token={callData?.token || ''}
          serverUrl={callData?.livekitServerUrl || ''}
          onConnected={handleConnected}
          onDisconnected={handleDisconnect}
          onError={handleError}
          style={{ height: '100%' }}
        >
          <MyVideoConference
            partnerName={partnerProfile.name}
            partnerLabel={partnerProfile.label}
            selfLabel={profile.label}
            onPermissionModalOpen={(permissions) => {
              setDeniedPermissions(permissions);
              setShowPermissionModal(true);
            }}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: 'black',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      >
        <h3 style={{ marginTop: 0, color: 'white' }}>Setup Instructions</h3>
        <ol style={{ margin: '10px 0', paddingLeft: '20px', color: '#d1d5db' }}>
          <li>Set NEXT_PUBLIC_LIVEKIT_TOKEN in your .env.local file</li>
          <li>Set NEXT_PUBLIC_LIVEKIT_URL in your .env.local file</li>
          <li>Open this page in two different browser tabs/windows to test the video call</li>
          <li>You should see your video in one tile, waiting for the partner in the other</li>
        </ol>
        <p style={{ marginBottom: 10, color: '#d1d5db' }}>
          <strong style={{ color: 'white' }}>Note:</strong> This example mimics your app&apos;s
          structure with GridLayout, ParticipantTile, and simple letter placeholders (Y for You, P
          for Partner).
        </p>
        <p style={{ marginBottom: 0, color: '#fbbf24' }}>
          <strong>Permission Testing:</strong> Try denying camera/microphone permissions to see the
          TrackToggle components automatically detect and display the permission denied state with
          warning icons. Click on a denied toggle to see the permissions modal with instructions.
        </p>
      </div>

      {showPermissionModal && (
        <PermissionsModal
          language="en"
          deniedPermissions={deniedPermissions}
          onClose={() => setShowPermissionModal(false)}
        />
      )}
    </div>
  );
}

export default VideoCallExample;
