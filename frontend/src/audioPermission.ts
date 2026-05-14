import { Capacitor, registerPlugin } from "@capacitor/core";

type PermissionValue = "granted" | "denied" | "prompt" | "prompt-with-rationale";

type AudioPermissionStatus = {
  microphone?: PermissionValue;
};

type AudioPermissionPlugin = {
  checkPermissions: () => Promise<AudioPermissionStatus>;
  requestPermissions: () => Promise<AudioPermissionStatus>;
};

const AudioPermission = registerPlugin<AudioPermissionPlugin>("AudioPermission");

const isGranted = (status: AudioPermissionStatus) => status.microphone === "granted";

export async function ensureMicrophonePermission() {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const current = await AudioPermission.checkPermissions();
    if (isGranted(current)) return true;

    const requested = await AudioPermission.requestPermissions();
    return isGranted(requested);
  } catch {
    return true;
  }
}
