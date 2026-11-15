import { track } from '@vercel/analytics';

/**
 * Privacy-respecting conversion event dispatcher for Vercel Analytics & GA4
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  try {
    // 1. Dispatch to Vercel Analytics
    track(eventName, properties);

    // 2. Dispatch to window.gtag if GA4 is loaded
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, properties);
    }
  } catch (err) {
    // Silent fail so user experience is never blocked
  }
}
