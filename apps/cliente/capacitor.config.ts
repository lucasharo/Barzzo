import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.barzzo.cliente",
  appName: "Barzzo",
  webDir: "dist",
  server: {
    // O WebView serve o app em https://localhost (sem tráfego em texto puro).
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    // Android 15+ desenha de borda a borda: o WebView ganha margens para não ficar sob as barras do sistema.
    adjustMarginsForEdgeToEdge: "auto",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: "#141416",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#141416",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
