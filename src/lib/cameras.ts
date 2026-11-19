import { z } from "zod";

export const ipv4 = z
  .string()
  .regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Enter four IPv4 octets.")
  .refine((v) => v.split(".").every((o) => Number(o) <= 255), "Each octet must be 0–255.");
export const networkSchema = z.object({
  ip: ipv4,
  gateway: ipv4,
  dns1: ipv4,
  dns2: ipv4,
  cidr: z.number().int().min(1).max(30),
  port: z.number().int().min(1).max(65535),
  securePort: z.number().int().min(1).max(65535),
  name: z.string().trim().min(1).max(60),
});
export type Network = z.infer<typeof networkSchema>;
export type Camera = Network & {
  id: string;
  type: "PTZ" | "Cinema" | "Studio/Other";
  brand: string;
  model: string;
  mac: string;
  serial: string;
  firmware: string;
  protocol: string;
  latency: number;
  status: "Online" | "Offline" | "Subnet Mismatch";
  source: "demo" | "local";
};
export function mask(cidr: number) {
  return Array.from({ length: 4 }, (_, i) => Math.max(0, Math.min(8, cidr - i * 8)))
    .map((bits) => 256 - 2 ** (8 - bits))
    .join(".");
}
export function sameSubnet(a: string, b: string, cidr: number) {
  const n = (ip: string) => ip.split(".").reduce((v, x) => (v * 256 + Number(x)) >>> 0, 0);
  const m = (0xffffffff << (32 - cidr)) >>> 0;
  return (n(a) & m) === (n(b) & m);
}
export function validateChange(camera: Camera, input: Network, cameras: Camera[]) {
  if (camera.type !== "PTZ")
    throw new Error("Only PTZ cameras support remote network reconfiguration.");
  const value = networkSchema.parse(input);
  if (cameras.some((c) => c.id !== camera.id && c.ip === value.ip))
    throw new Error("IP collision: this address is already assigned to another camera.");
  const octets = value.ip.split(".").map(Number);
  const firstOctet = octets[0];
  if (firstOctet === undefined || firstOctet === 0 || firstOctet >= 224)
    throw new Error("Use a unicast camera address.");
  const host = octets.reduce((v, x) => (v * 256 + x) >>> 0, 0) & (2 ** (32 - value.cidr) - 1);
  if (host === 0 || host === 2 ** (32 - value.cidr) - 1)
    throw new Error("Network and broadcast addresses cannot be assigned to a camera.");
  if (value.gateway !== "0.0.0.0" && !sameSubnet(value.ip, value.gateway, value.cidr))
    throw new Error("Gateway must be on the camera’s subnet.");
  return value;
}
const rows: [
  Camera["type"],
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  Camera["status"],
  string,
][] = [
  [
    "Cinema",
    "ARRI",
    "Alexa 35",
    "A-CAM",
    "85",
    "00:1E:C0:4A:7B:12",
    "Bonjour / mDNS / CAP",
    "1.4",
    "Online",
    "7.2.1",
  ],
  [
    "Cinema",
    "RED",
    "V-RAPTOR",
    "B-CAM",
    "86",
    "00:26:4C:92:16:08",
    "mDNS / RED RCP2",
    "1.8",
    "Online",
    "1.7.1",
  ],
  [
    "PTZ",
    "Panasonic",
    "AW-UE70",
    "STAGE LEFT",
    "147",
    "20:C6:EB:EF:6D:CA",
    "Panasonic Easy IP",
    "0.8",
    "Online",
    "2.14",
  ],
  [
    "PTZ",
    "Sony",
    "BRC-X400",
    "STAGE RIGHT",
    "148",
    "54:42:49:7B:11:02",
    "VISCA over IP",
    "1.1",
    "Online",
    "2.10",
  ],
  [
    "PTZ",
    "BirdDog",
    "P200",
    "WIDE",
    "150",
    "2C:27:9E:60:4B:09",
    "mDNS / NDI",
    "2.2",
    "Online",
    "5.5.1",
  ],
  [
    "Cinema",
    "Blackmagic",
    "URSA Cine 12K",
    "C-CAM",
    "90",
    "7C:2E:0D:84:01:32",
    "Bonjour / mDNS",
    "1.6",
    "Online",
    "9.5",
  ],
  [
    "Cinema",
    "Sony",
    "FX6",
    "HANDHELD",
    "92",
    "70:B3:D5:19:41:08",
    "mDNS / HTTP",
    "0",
    "Offline",
    "5.00",
  ],
  [
    "Studio/Other",
    "Blackmagic",
    "Studio Camera 6K",
    "DESK",
    "110",
    "7C:2E:0D:84:01:44",
    "mDNS / HTTP",
    "1.2",
    "Online",
    "8.7",
  ],
  [
    "PTZ",
    "Canon",
    "CR-N500",
    "AUDIENCE",
    "151",
    "18:0C:AC:52:31:77",
    "ONVIF / XC",
    "1.7",
    "Online",
    "1.5.0",
  ],
  [
    "PTZ",
    "PTZOptics",
    "Move 4K",
    "BALCONY",
    "152",
    "D4:E8:53:22:67:10",
    "ONVIF / VISCA",
    "3.1",
    "Subnet Mismatch",
    "1.4.2",
  ],
];
export const demoCameras: Camera[] = rows.map((r, i) => ({
  id: `demo-${i}`,
  type: r[0] as Camera["type"],
  brand: r[1],
  model: r[2],
  name: r[3],
  ip: i === 9 ? "192.168.2.152" : `192.168.1.${r[4]}`,
  mac: r[5],
  protocol: r[6],
  latency: Number(r[7]),
  status: r[8] as Camera["status"],
  firmware: r[9],
  serial: `SN-${["A3501274", "VR089421", "UE701048"][i % 3]}${i || ""}`,
  port: 80,
  securePort: 443,
  cidr: 24,
  gateway: "192.168.1.1",
  dns1: "0.0.0.0",
  dns2: "0.0.0.0",
  source: "demo",
}));
export function csv(cameras: Camera[]) {
  const headers = [
    "Status",
    "Type",
    "Brand",
    "Model",
    "Camera Name",
    "IP",
    "MAC",
    "Protocol",
    "Port",
    "Firmware",
  ];
  return [
    headers,
    ...cameras.map((c) => [
      c.status,
      c.type,
      c.brand,
      c.model,
      c.name,
      c.ip,
      c.mac,
      c.protocol,
      c.port,
      c.firmware,
    ]),
  ]
    .map((row) =>
      row
        .map(
          (v) =>
            `"${String(v)
              .replace(/"/g, '""')
              .replace(/^[=+@-]/, "'$&")}"`,
        )
        .join(","),
    )
    .join("\r\n");
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
