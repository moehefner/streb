import React from 'react';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
import { Scene, SceneData } from './Scene';

// Types for video script
export interface VideoScript {
  title: string;
  totalDuration: number;
  scenes: SceneData[];
  callToAction: string;
  voiceoverStyle?: 'professional' | 'casual' | 'energetic';
  musicMood?: 'upbeat' | 'inspiring' | 'calm' | 'tech';
  metadata?: {
    appName?: string;
    appDescription?: string;
    videoType?: string;
    generatedAt?: string;
  };
}

export interface VideoProps extends Record<string, unknown> {
  script: VideoScript;
  screenshots: string[]; // Array of screenshot URLs
  backgroundMusicUrl?: string;
  voiceoverUrl?: string;
}

export const VideoComposition: React.FC<VideoProps> = ({
  script,
  screenshots,
  backgroundMusicUrl,
  voiceoverUrl
}) => {
  const fps = 30;
  let currentFrame = 0;

  // Get screenshot URL for a scene
  const getScreenshotUrl = (screenshotIndex: number | null): string | undefined => {
    if (screenshotIndex === null || screenshotIndex === undefined) {
      return undefined;
    }
    if (screenshotIndex >= 0 && screenshotIndex < screenshots.length) {
      return screenshots[screenshotIndex];
    }
    return undefined;
  };

  // Get background color based on scene type
  const getBackgroundColor = (sceneType: string): string => {
    const colors: Record<string, string> = {
      intro: '#1a1a2e',
      problem: '#16213e',
      solution: '#0f3460',
      feature: '#1a1a2e',
      demo: '#0a0a0a',
      cta: '#e94560',
      testimonial: '#1a1a2e'
    };
    return colors[sceneType] || '#0a0a0a';
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Render each scene as a sequence */}
      {script.scenes.map((scene, index) => {
        const durationInFrames = Math.floor(scene.duration * fps);
        const startFrame = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence
            key={`scene-${scene.id}`}
            from={startFrame}
            durationInFrames={durationInFrames}
            name={`Scene ${scene.id}: ${scene.type}`}
          >
            <Scene
              scene={{
                ...scene,
                screenshotUrl: getScreenshotUrl(scene.screenshotIndex)
              }}
              isFirstScene={index === 0}
              isLastScene={index === script.scenes.length - 1}
              callToAction={script.callToAction}
              backgroundColor={getBackgroundColor(scene.type)}
              appName={script.metadata?.appName}
            />
          </Sequence>
        );
      })}

      {/* Background Music (optional) */}
      {backgroundMusicUrl && (
        <Audio
          src={backgroundMusicUrl}
          volume={0.3} // 30% volume so it doesn't overpower voiceover
          startFrom={0}
        />
      )}

      {/* Voiceover Audio (optional) */}
      {voiceoverUrl && (
        <Audio
          src={voiceoverUrl}
          volume={1}
          startFrom={0}
        />
      )}
    </AbsoluteFill>
  );
};
