import type { Device } from "../data/devices";
export function DeviceIcon({ device }: { device: Device }) {
  return (
    <div
      className={`device-icon device-${device.id}`}
      style={{
        backgroundColor: device.color,
        width: device.cols * 38,
        height: device.rows * 28,
      }}
      aria-hidden="true"
    >
      <span>{device.id === "pro" ? "⠿ ⠿" : device.name}</span>
      <i />
    </div>
  );
}
