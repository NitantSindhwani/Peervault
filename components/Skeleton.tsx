'use client';

export interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
}

export function Skeleton({ className = '', height, width }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--border-color)]/50 rounded-lg ${className}`}
      style={{ height, width }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4">
      <Skeleton height="24px" width="60%" />
      <Skeleton height="16px" width="90%" />
      <Skeleton height="16px" width="75%" />
      <div className="pt-4 flex gap-3">
        <Skeleton height="40px" width="120px" />
        <Skeleton height="40px" width="120px" />
      </div>
    </div>
  );
}
