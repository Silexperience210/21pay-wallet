// Jest manual mock for react-native-webview. The real package is a native module
// (Android/iOS WebView) that cannot load under jest-expo / the node test env
// (mirrors how Phase 1 mocked react-native-keychain and Phase 4 mocked the Breez
// Spark SDK). The WebView itself is exercised only at the device checkpoint (05-06);
// unit/screen tests only need the native module to resolve and render a no-op.
//
// Auto-applied by Jest for node_modules mocks placed in the root __mocks__/.
import * as React from 'react';

// All event/message callback props are accepted and held as no-ops so screen
// tests can render <WebView .../> without crashing on the missing native module.
export interface WebViewMockProps {
  source?: { uri?: string; headers?: Record<string, string> };
  originWhitelist?: string[];
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onShouldStartLoadWithRequest?: (req: { url: string }) => boolean;
  onRenderProcessGone?: (event: unknown) => boolean | void;
  onError?: (event: unknown) => void;
  onHttpError?: (event: unknown) => void;
  injectedJavaScriptBeforeContentLoaded?: string;
  setSupportMultipleWindows?: boolean;
  allowFileAccess?: boolean;
  allowFileAccessFromFileURLs?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  testID?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

/** Functional component stub — renders nothing, ignores all WebView props. */
export const WebView = React.forwardRef<unknown, WebViewMockProps>(function WebView(_props, _ref) {
  return null;
});

export type WebViewMessageEvent = { nativeEvent: { data: string } };

export default WebView;
