"use client";

interface SkipLinkProps {
  targetId?: string;
}

export function SkipLink({ targetId = "main-content" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        zIndex: 9999,
      }}
      onFocus={(e) => {
        e.currentTarget.style.position = 'fixed';
        e.currentTarget.style.left = '16px';
        e.currentTarget.style.top = '16px';
        e.currentTarget.style.width = 'auto';
        e.currentTarget.style.height = 'auto';
        e.currentTarget.style.padding = '12px 20px';
        e.currentTarget.style.background = '#EC4899';
        e.currentTarget.style.color = '#fff';
        e.currentTarget.style.borderRadius = '8px';
        e.currentTarget.style.fontWeight = '600';
        e.currentTarget.style.textDecoration = 'none';
        e.currentTarget.style.zIndex = '9999';
        e.currentTarget.style.outline = 'none';
      }}
      onBlur={(e) => {
        e.currentTarget.style.position = 'absolute';
        e.currentTarget.style.left = '-9999px';
        e.currentTarget.style.width = '1px';
        e.currentTarget.style.height = '1px';
      }}
    >
      Skip to main content
    </a>
  );
}