'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'motion/react';

// --- Shiny Text ---
export function ShinyText({
  text,
  disabled = false,
  speed = 3,
  className = '',
}: {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block bg-[linear-gradient(120deg,rgba(255,255,255,0.75)_35%,rgba(255,255,255,1)_50%,rgba(255,255,255,0.75)_65%)] bg-[length:200%_100%] bg-clip-text text-transparent [text-fill-color:transparent] ${
        disabled ? '' : 'animate-shimmer'
      } ${className}`}
      style={{
        animationDuration,
        backgroundImage: disabled ? 'none' : undefined,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: disabled ? 'inherit' : 'transparent',
      }}
    >
      {text}
    </span>
  );
}

// --- Gradient Text ---
export function GradientText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`text-gradient-animated ${className}`}>
      {text}
    </span>
  );
}

// --- Blur Text ---
export function BlurText({
  text,
  delay = 0.05,
  duration = 0.6,
  className = '',
}: {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const words = text.split(' ');

  if (reduce) {
    return <span className={className}>{text}</span>;
  }

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: delay,
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, filter: 'blur(10px)', y: 15 },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // ease-snappy
      },
    },
  };

  return (
    <motion.span
      className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="inline-block whitespace-nowrap"
          variants={wordVariants}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// --- Count Up ---
export function CountUp({
  to,
  from = 0,
  duration = 2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: {
  to: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const [count, setCount] = useState(from);
  const elementRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(elementRef, { once: true, margin: '-50px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!isInView) return;
    if (reduce) {
      setCount(to);
      return;
    }

    let startTime: number | null = null;

    const animateCount = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      // Easing function: easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentVal = from + (to - from) * easeProgress;
      
      setCount(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animateCount);
      }
    };

    requestAnimationFrame(animateCount);
  }, [isInView, to, from, duration, reduce]);

  const formattedCount = count.toFixed(decimals);

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {formattedCount}
      {suffix}
    </span>
  );
}
