/**
 * Runs an artifact on the phone, in its own web view. It can't reach the
 * app's data except by asking through the bridge, and links open in Safari
 * instead of replacing the artifact.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Linking } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface ArtifactFrameHandle {
  reply: (id: number, ok: boolean, data: unknown) => void;
  setPicking: (on: boolean) => void;
}

export interface ArtifactFrameProps {
  html: string;
  onMessage: (msg: { type: string; [k: string]: unknown }) => void;
}

const BASE = 'https://artifact.eternity.app/';

export const ArtifactFrame = forwardRef<ArtifactFrameHandle, ArtifactFrameProps>(function ArtifactFrame({ html, onMessage }, ref) {
  const web = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    reply: (id, ok, data) => web.current?.injectJavaScript(`window.__eternityReply && window.__eternityReply(${id}, ${ok}, ${JSON.stringify(data ?? null)}); true;`),
    setPicking: (on) => web.current?.injectJavaScript(`window.__eternityPicking = ${on ? 'true' : 'false'}; true;`),
  }));
  return (
    <WebView
      ref={web}
      source={{ html, baseUrl: BASE }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={(e: WebViewMessageEvent) => {
        try {
          onMessage(JSON.parse(e.nativeEvent.data));
        } catch {
          /* ignore */
        }
      }}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url === BASE || req.url.startsWith('about:') || req.url.startsWith('data:')) return true;
        // Only the top frame navigating away is blocked; iframes and CDN loads are fine.
        if (req.isTopFrame === false) return true;
        if (/^https?:/.test(req.url)) Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      setSupportMultipleWindows={false}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  );
});
