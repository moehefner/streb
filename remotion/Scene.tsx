import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  spring
} from 'remotion';

// Scene data interface
export interface SceneData {
  id: number;
  type: 'intro' | 'problem' | 'solution' | 'feature' | 'demo' | 'cta' | 'testimonial' | string;
  duration: number;
  screenshotIndex: number | null;
  screenshotUrl?: string;
  textOverlay: string[];
  voiceover: string;
  transition: 'fade' | 'slide' | 'zoom' | string;
}

interface SceneProps {
  scene: SceneData;
  isFirstScene: boolean;
  isLastScene: boolean;
  callToAction?: string;
  backgroundColor?: string;
  appName?: string;
}

export const Scene: React.FC<SceneProps> = ({
  scene,
  isFirstScene,
  isLastScene,
  callToAction,
  backgroundColor = '#0a0a0a',
  appName
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Determine if vertical (TikTok/Reels) or horizontal (YouTube/Twitter)
  const isVertical = height > width;

  // Fade in animation (first 15 frames = 0.5 seconds)
  const fadeIn = interpolate(
    frame,
    [0, 15],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Fade out animation (last 15 frames)
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' }
  );

  // Combined opacity
  const opacity = Math.min(fadeIn, fadeOut);

  // Text slide-up animation with spring physics
  const textSlideUp = spring({
    frame: frame - 8,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5
    }
  });

  const textTransform = `translateY(${interpolate(textSlideUp, [0, 1], [60, 0])}px)`;

  // Screenshot zoom animation (subtle Ken Burns effect)
  const zoomAmount = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.08],
    { extrapolateRight: 'clamp' }
  );

  // Screenshot pan animation (subtle movement)
  const panX = interpolate(
    frame,
    [0, durationInFrames],
    [0, isVertical ? 0 : 20],
    { extrapolateRight: 'clamp' }
  );

  const panY = interpolate(
    frame,
    [0, durationInFrames],
    [0, isVertical ? 30 : 10],
    { extrapolateRight: 'clamp' }
  );

  // Font sizes based on orientation
  const titleFontSize = isVertical ? 64 : 80;
  const subtitleFontSize = isVertical ? 48 : 60;
  const ctaFontSize = isVertical ? 36 : 44;

  // Padding based on orientation
  const containerPadding = isVertical ? '60px 40px' : '80px';

  return (
    <AbsoluteFill style={{ opacity, backgroundColor }}>
      {/* Background Screenshot with Ken Burns effect */}
      {scene.screenshotUrl && (
        <AbsoluteFill
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}
        >
          <Img
            src={scene.screenshotUrl}
            style={{
              width: isVertical ? 'auto' : '100%',
              height: isVertical ? '100%' : 'auto',
              minWidth: '100%',
              minHeight: '100%',
              objectFit: 'cover',
              transform: `scale(${zoomAmount}) translate(${panX}px, ${panY}px)`,
              filter: 'brightness(0.5) saturate(1.1)' // Darken for text readability
            }}
          />
        </AbsoluteFill>
      )}

      {/* Gradient Overlay for better text readability */}
      <AbsoluteFill
        style={{
          background: scene.screenshotUrl
            ? `linear-gradient(
                to bottom,
                rgba(0,0,0,0.4) 0%,
                rgba(0,0,0,0.2) 30%,
                rgba(0,0,0,0.2) 70%,
                rgba(0,0,0,0.7) 100%
              )`
            : 'transparent'
        }}
      />

      {/* Scene Type Badge (top left) */}
      {!isLastScene && (
        <div
          style={{
            position: 'absolute',
            top: isVertical ? 100 : 40,
            left: 40,
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '20px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Inter, Arial, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            opacity: textSlideUp
          }}
        >
          {scene.type}
        </div>
      )}

      {/* Main Text Content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isVertical ? 'center' : 'center',
          alignItems: 'center',
          padding: containerPadding,
          transform: textTransform,
          opacity: textSlideUp
        }}
      >
        {scene.textOverlay.map((line, index) => (
          <div
            key={index}
            style={{
              fontSize: index === 0 ? titleFontSize : subtitleFontSize,
              fontWeight: index === 0 ? 800 : 600,
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: index === 0 ? '24px' : '8px',
              textShadow: `
                0 4px 20px rgba(0,0,0,0.8),
                0 0 60px rgba(0,0,0,0.5),
                0 2px 4px rgba(0,0,0,0.9)
              `,
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              lineHeight: 1.2,
              maxWidth: isVertical ? '90%' : '80%',
              letterSpacing: index === 0 ? '-1px' : '0'
            }}
          >
            {line}
          </div>
        ))}
      </AbsoluteFill>

      {/* Call to Action (Last Scene Only) */}
      {isLastScene && callToAction && (
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: isVertical ? '0 40px 120px' : '0 80px 100px'
          }}
        >
          {/* CTA Button Style */}
          <div
            style={{
              padding: isVertical ? '20px 40px' : '24px 60px',
              backgroundColor: '#FF3D71',
              borderRadius: '50px',
              fontSize: ctaFontSize,
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              boxShadow: `
                0 4px 30px rgba(255, 61, 113, 0.5),
                0 0 60px rgba(255, 61, 113, 0.3)
              `,
              transform: `scale(${interpolate(textSlideUp, [0, 1], [0.8, 1])})`,
              opacity: textSlideUp
            }}
          >
            {callToAction}
          </div>

          {/* App Name below CTA */}
          {appName && (
            <div
              style={{
                marginTop: '24px',
                fontSize: isVertical ? 24 : 28,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                opacity: interpolate(textSlideUp, [0, 1], [0, 0.8])
              }}
            >
              {appName}
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* Progress Indicator (bottom) */}
      {!isLastScene && (
        <div
          style={{
            position: 'absolute',
            bottom: isVertical ? 80 : 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px'
          }}
        >
          {/* Small dots showing scene progress - visual only */}
          <div
            style={{
              width: '40px',
              height: '4px',
              backgroundColor: '#FF3D71',
              borderRadius: '2px'
            }}
          />
          <div
            style={{
              width: '40px',
              height: '4px',
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: '2px'
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};
