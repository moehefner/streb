"use client";

import Link from "next/link";
import { Pill } from "./pill";
import { Button } from "./ui/button";
import { useState } from "react";

export function Hero() {
  const [hovering, setHovering] = useState(false);
  return (
    <div className="flex flex-col h-svh justify-between bg-black">
      {/* Black background instead of 3D particles */}
      <div className="absolute inset-0 bg-black"></div>

      <div className="pb-16 mt-auto text-center relative z-10">
        <Pill className="mb-6">BETA RELEASE</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-sentient text-white">
          Unlock your <br />
          <i className="font-light">future</i> growth
        </h1>
        <p className="font-mono text-sm sm:text-base text-white/60 text-balance mt-8 max-w-[440px] mx-auto">
          Through perpetual investment strategies that outperform the market
        </p>

        <Link className="contents max-sm:hidden" href="/sign-up">
          <Button
            className="mt-14 bg-white text-black hover:bg-white/90"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            [Get Started]
          </Button>
        </Link>
        <Link className="contents sm:hidden" href="/sign-up">
          <Button
            size="sm"
            className="mt-14 bg-white text-black hover:bg-white/90"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            [Get Started]
          </Button>
        </Link>
      </div>
    </div>
  );
}