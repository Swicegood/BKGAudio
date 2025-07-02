module.exports = ({ config }) => {
  const isDebug = process.env.APP_VARIANT === 'debug';

  return {
    name: isDebug ? "BKGAudio (Debug)" : "BKGAudio",
    slug: "bkgaudio",
    version: "2.1.0",
    platforms: ["ios", "android"],
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      bundleIdentifier: isDebug ? "com.iskcon.bkgaudio.debug" : "com.iskcon.bkgaudio",
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ["audio", "fetch"]
      },
      buildNumber: "21",
      config: {
        usesSwift: true,
        swiftVersion: "5.0"
      }
    },
    android: {
      package: isDebug ? "com.iskcon.bkgaudio.debug" : "com.iskcon.bkgaudio",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      versionCode: 5,
      permissions: ["FOREGROUND_SERVICE", "WAKE_LOCK"]
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "4ba6b561-4157-47fc-b95b-5369a02198cd"
      },
      enableVerboseLogging: isDebug,
    },
    updates: {
      url: "https://u.expo.dev/4ba6b561-4157-47fc-b95b-5369a02198cd"
    },
    runtimeVersion: {
      policy: "appVersion"
    }
  };
};