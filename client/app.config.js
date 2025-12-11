export default {
  expo: {
    name: "TeamUpProject",
    slug: "teamup-project",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "teamupproject",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.umaps.teamup",
      infoPlist: {
        CFBundleAllowMixedLocalizations: true,
        ExpoLocalization_supportsRTL: true,
      },
    },
    android: {
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        // foregroundImage: "./assets/images/book_icon.png",
        backgroundColor: "#232323",
      },
      package: "com.umaps.teamup",
      package_name: "com.umaps.teamup",
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-document-picker",
      "react-native-video",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
          },
        },
      ],
      "expo-localization",
      [
        "expo-image-picker",
        {
          photosPermission:
            "The app accesses your photos to let you share them with us.",
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "296827dd-411a-43bf-96f7-1558ed010464"
      }
    }
  }
}; 