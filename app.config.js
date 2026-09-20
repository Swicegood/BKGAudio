module.exports = ({ config }) => {
  const isDebug = process.env.APP_VARIANT === 'debug';
  const isSupport = process.env.APP_VARIANT === 'support';

  return {
    name: isDebug ? "BKGAudio (Debug)" : "BKGAudio",
    slug: "bkgaudio",
    version: "2.3.1",
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
      buildNumber: "24",
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
      versionCode: 10,
      permissions: [
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "WAKE_LOCK",
        "POST_NOTIFICATIONS",
      ],
    },
    newArchEnabled: true,
    plugins: [
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Satoshi-Bold.otf",
            "./assets/fonts/Satoshi-Regular.otf",
            "./assets/fonts/material.ttf",
          ],
        },
      ],
      "expo-asset",
      [
        "expo-audio",
        {
          enableBackgroundPlayback: false,
          recordAudioAndroid: false,
          microphonePermission: false,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
          },
        },
      ],
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "4ba6b561-4157-47fc-b95b-5369a02198cd"
      },
      enableVerboseLogging: isSupport || isDebug,
    },
    updates: {
      url: "https://u.expo.dev/4ba6b561-4157-47fc-b95b-5369a02198cd",
      checkAutomatically: "NEVER",
    },
    runtimeVersion: {
      policy: "appVersion"
    }
  };
};