import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.barzzo.parceiro",
  appName: "Barzzo Parceiro",
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
      backgroundColor: "#0A0A0B",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0B",
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
