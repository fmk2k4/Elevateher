/**
 * Design Mode utilities for web design inspection
 */

export type GetStyleInfo = (resolved: { element: HTMLElement | null }) => {
  className: string;
  styles: Record<string, string> | null;
};

export function initDesignMode(getStyleInfo: GetStyleInfo) {
  // Stub implementation for design mode
  // Returns a no-op reselect function
  const reselect = () => {
    // No-op
  };
  return reselect;
}
