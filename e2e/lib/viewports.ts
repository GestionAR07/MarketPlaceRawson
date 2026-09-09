/**
 * Viewport presets for Pedilo responsive QA.
 * These cover representative phones plus tablet / desktop without pretending
 * to emulate browser-engine-specific Safari or Android behavior.
 */
export const E2E_VIEWPORTS = {
  narrowPhone: { width: 320, height: 568 },
  androidSmall: { width: 360, height: 800 },
  iphoneSmall: { width: 375, height: 667 },
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1366, height: 768 },
} as const;

export const E2E_PHONE_VIEWPORTS = {
  narrowPhone: E2E_VIEWPORTS.narrowPhone,
  androidSmall: E2E_VIEWPORTS.androidSmall,
  iphoneSmall: E2E_VIEWPORTS.iphoneSmall,
  mobile: E2E_VIEWPORTS.mobile,
} as const;

export type E2eViewportName = keyof typeof E2E_VIEWPORTS;
