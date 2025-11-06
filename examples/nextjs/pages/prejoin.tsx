'use client';

import * as React from 'react';
import { PreJoin, PreJoinValues, setLogLevel } from '@livekit/components-react';
import type { NextPage } from 'next';
import { Track, TrackProcessor } from 'livekit-client';
import { BackgroundBlur } from '@livekit/track-processors';

const PreJoinExample: NextPage = () => {
  setLogLevel('debug', { liveKitClientLogLevel: 'warn' });

  const [backgroundBlur, setBackgroundBlur] = React.useState<
    TrackProcessor<Track.Kind.Video> | undefined
  >(undefined);

  React.useEffect(() => {
    setBackgroundBlur(BackgroundBlur());
  }, []);

  const handleError = (error: Error) => {
    console.log('error', error);
  };

  const handleValidate = (values: PreJoinValues) => {
    const isValid = Boolean(values.audioDeviceId || values.videoDeviceId);
    console.log({ isValid, values });
    return isValid;
  };

  return (
    <div data-lk-theme="default" style={{ height: '100vh' }}>
      <PreJoin
        onError={handleError}
        onValidate={handleValidate}
        videoProcessor={backgroundBlur}
        defaults={{
          videoDeviceId: '',
          videoEnabled: true,
          audioEnabled: true,
        }}
        onSubmit={(values) => {
          values.audioDeviceId;
        }}
      />
    </div>
  );
};

export default PreJoinExample;
