/**
 * The WebView, wrapped so the web build doesn't try to load a native module.
 * Web gets a friendly note instead (the browser lives in the phone app).
 */
import React, { forwardRef } from 'react';
import { Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { Txt } from './ui';

export interface BrowserViewProps {
  url: string;
  injected: string;
  onMessage: (e: WebViewMessageEvent) => void;
  onNav: (n: WebViewNavigation) => void;
  onLoadEnd?: () => void;
}

export const BrowserView = forwardRef<WebView, BrowserViewProps>(function BrowserView({ url, injected, onMessage, onNav, onLoadEnd }, ref) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Txt variant="h3" center>
          Eternity Browser runs in the iPhone app.
        </Txt>
        <Txt variant="small" center style={{ marginTop: 6 }}>
          {url}
        </Txt>
      </View>
    );
  }
  return (
    <WebView
      ref={ref}
      source={{ uri: url }}
      injectedJavaScript={injected}
      onMessage={onMessage}
      onNavigationStateChange={onNav}
      onLoadEnd={onLoadEnd}
      allowsBackForwardNavigationGestures
      pullToRefreshEnabled
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      style={{ flex: 1 }}
    />
  );
});
