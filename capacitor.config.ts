import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.xiaobao.growthcompanion",
  appName: "小宝成长伙伴",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: "http",
    cleartext: true,
  },
  plugins: {
    Camera: {
      permissions: ["camera", "photos"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2f5e4d",
    },
  },
};

export default config;
