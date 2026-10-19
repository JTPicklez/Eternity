/**
 * Runs an artifact on the web, in a sandboxed iframe with no access to the
 * app's origin. It talks to the app only through postMessage.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface ArtifactFrameHandle {
  reply: (id: number, ok: boolean, data: unknown) => void;
  setPicking: (on: boolean) => void;
}

export interface ArtifactFrameProps {
  html: string;
  onMessage: (msg: { type: string; [k: string]: unknown }) => void;
}

export const ArtifactFrame = forwardRef<ArtifactFrameHandle, ArtifactFrameProps>(function ArtifactFrame({ html, onMessage }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useImperativeHandle(ref, () => ({
    reply: (id, ok, data) => frame.current?.contentWindow?.postMessage({ eternityReply: true, id, ok, data }, '*'),
    setPicking: (on) => frame.current?.contentWindow?.postMessage({ eternityPick: on }, '*'),
  }));

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const d = e.data as { eternity?: boolean; payload?: string };
      if (!d || !d.eternity || typeof d.payload !== 'string') return;
      try {
        handler.current(JSON.parse(d.payload));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  return (
    <iframe
      ref={frame}
      title="Artifact"
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-modals allow-popups"
      style={{ border: 'none', width: '100%', height: '100%', background: 'transparent', flex: 1 }}
    />
  );
});
