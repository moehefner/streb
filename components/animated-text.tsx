"use client"

import { motion } from "framer-motion"

interface AnimatedTextProps {
  text: string
  delay?: number
}

export function AnimatedText({ text, delay = 0 }: AnimatedTextProps) {
  const words = text.split(" ")
  let charIndex = 0

  return (
    <div className="w-full inline-block text-center">
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block whitespace-nowrap">
          {word.split("").map((char, index) => {
            const currentCharIndex = charIndex++
            return (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: delay + currentCharIndex * 0.03,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                style={{ display: "inline-block" }}
              >
                {char}
              </motion.span>
            )
          })}
          {/* Add space after word except for last word */}
          {wordIndex < words.length - 1 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: delay + charIndex++ * 0.03,
              }}
            >
              {"\u00A0"}
            </motion.span>
          )}
        </span>
      ))}
    </div>
  )
}