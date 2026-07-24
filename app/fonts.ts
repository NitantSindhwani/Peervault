import { Orbitron, JetBrains_Mono } from 'next/font/google';

export const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-display',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});
