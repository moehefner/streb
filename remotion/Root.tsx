import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition, VideoProps, VideoScript } from './VideoComposition';

// Default props for the composition
const defaultScript: VideoScript = {
  title: 'Sample Video',
  totalDuration: 60,
  scenes: [
    {
      id: 1,
      type: 'intro',
      duration: 10,
      screenshotIndex: 0,
      textOverlay: ['Welcome', 'To Your App'],
      voiceover: 'Welcome to your app demo.',
      transition: 'fade'
    }
  ],
  callToAction: 'Try it free today!',
  voiceoverStyle: 'professional',
  musicMood: 'upbeat'
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 30 Second Video - TikTok/Reels optimized */}
      <Composition<any, VideoProps>
        id="StrebVideo30"
        component={VideoComposition}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1080}
        height={1920} // Vertical for TikTok/Reels
        defaultProps={{
          script: defaultScript,
          screenshots: []
        }}
      />

      {/* 60 Second Video - Standard */}
      <Composition<any, VideoProps>
        id="StrebVideo60"
        component={VideoComposition}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1920}
        height={1080} // Horizontal for YouTube/Twitter
        defaultProps={{
          script: defaultScript,
          screenshots: []
        }}
      />

      {/* 90 Second Video - Extended */}
      <Composition<any, VideoProps>
        id="StrebVideo90"
        component={VideoComposition}
        durationInFrames={2700} // 90 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          script: defaultScript,
          screenshots: []
        }}
      />

      {/* Square Video - Instagram Feed */}
      <Composition<any, VideoProps>
        id="StrebVideoSquare"
        component={VideoComposition}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1080} // Square for Instagram feed
        defaultProps={{
          script: defaultScript,
          screenshots: []
        }}
      />
    </>
  );
};
