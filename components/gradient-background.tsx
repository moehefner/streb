"use client"

import { GrainGradient } from "@paper-design/shaders-react"

export function GradientBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <GrainGradient
        style={{ height: "100vh", width: "100vw" }}
        colorBack="hsl(0, 0%, 0%)"
        softness={0.9}
        intensity={0.25}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1.2}
        rotation={0}
        speed={0.25}
        colors={["hsl(0, 0%, 70%)", "hsl(0, 0%, 85%)", "hsl(0, 0%, 60%)"]}
      />
    </div>
  )
}