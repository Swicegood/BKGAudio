module.exports = {
  name: "BKGAudio",
  slug: "bkgaudio",
  version: "1.3.4",
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
    bundleIdentifier: "com.iskcon.bkgaudio",
    supportsTablet: true,
    infoPlist: {
      UIBackgroundModes: ["audio"],
    },
    buildNumber: "8",
  },
  android: {
    package: "com.iskcon.bkgaudio",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    versionCode: 5
  },
  web: {
    favicon: "./assets/favicon.png",
  },
    extra:{
      eas: {
        projectId: "4ba6b561-4157-47fc-b95b-5369a02198cd"
      }
    }
      
  };
  