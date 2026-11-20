import { z } from "zod";

export const scanNetworkSchema = z.object({
  name: z.string().max(100),
  target: z.string().max(80),
  limited: z.boolean(),
});

export const scanMethodSchema = z.object({
  adapters: z.number(),
  sent: z.number(),
  pinned: z.number().optional(),
  replies: z.number(),
  parsed: z.number(),
  errors: z.array(z.string().max(300)).max(12),
  sample: z.string().max(1000),
});

export const scanDiagnosticsSchema = z.record(z.string().max(20), scanMethodSchema);

export type ScanNetwork = z.infer<typeof scanNetworkSchema>;
export type ScanMethod = z.infer<typeof scanMethodSchema>;
export type ScanDiagnostics = z.infer<typeof scanDiagnosticsSchema>;

export type ScanAdvice = {
  kind:
    | "port-conflict"
    | "no-network"
    | "no-requests"
    | "unrecognised-replies"
    | "filtered-replies"
    | "physical-connection";
  title: string;
  detail: string;
};

export type ScanMethodResult = {
  id: string;
  name: string;
  detail: string;
  attention: boolean;
};

export type ScanSummary = {
  networks: ScanNetwork[];
  methods: ScanMethodResult[];
  advice: ScanAdvice[];
};

const methodNames: Record<string, string> = {
  panasonic: "Panasonic EasyIP",
  sony: "Sony VISCA",
};

function methodResult(id: string, method?: ScanMethod): ScanMethodResult {
  if (!method)
    return {
      id,
      name: methodNames[id] ?? id,
      detail: "Search completed",
      attention: false,
    };
  return {
    id,
    name: methodNames[id] ?? id,
    detail: method.errors.length
      ? "Finished with a connection problem"
      : `${method.adapters} connections · ${method.sent} requests · ${method.replies} replies · ${method.parsed} recognised`,
    attention:
      method.errors.length > 0 || method.sent === 0 || (method.replies > 0 && method.parsed === 0),
  };
}

export function summariseScan({
  automatic,
  networks,
  diagnostics,
  deviceCount,
}: {
  automatic: boolean;
  networks: ScanNetwork[];
  diagnostics: ScanDiagnostics;
  deviceCount: number;
}): ScanSummary {
  const panasonic = diagnostics["panasonic"];
  const sony = diagnostics["sony"];
  const methods = [
    methodResult("panasonic", panasonic),
    methodResult("sony", sony),
    {
      id: "service-discovery",
      name: "ONVIF + Bonjour",
      detail: "Search completed",
      attention: false,
    },
    {
      id: "address-checks",
      name: "HTTP + TCP checks",
      detail: "Selected addresses checked",
      attention: false,
    },
  ];
  const advice: ScanAdvice[] = [];
  const allMethods = [panasonic, sony].filter((method): method is ScanMethod => Boolean(method));
  const errors = allMethods.flatMap((method) => method.errors);

  if (automatic && networks.length === 0) {
    advice.push({
      kind: "no-network",
      title: "No private camera network was found",
      detail:
        "Connect this computer to the camera switch by Ethernet or Wi-Fi, then scan again. You can also enter a private IP or range above.",
    });
  }

  if (errors.some((error) => error.includes("EADDRINUSE"))) {
    advice.push({
      kind: "port-conflict",
      title: "Another camera tool may be blocking the search",
      detail:
        "Quit Panasonic EasyIP and other camera-discovery tools, then scan again. They can occupy the port ptzIP needs for camera replies.",
    });
  }

  if (
    networks.length > 0 &&
    allMethods.some((method) => method.adapters > 0 && method.sent === 0)
  ) {
    advice.push({
      kind: "no-requests",
      title: "Some searches could not leave this computer",
      detail:
        "Allow ptzIP to access your local network, check the camera connection, and try again. The report lists the affected connection.",
    });
  }

  if (allMethods.some((method) => method.replies > 0 && method.parsed === 0)) {
    advice.push({
      kind: "unrecognised-replies",
      title: "A device replied, but ptzIP could not identify it",
      detail:
        "Copy the scan report so the reply can be examined. You can also query its known IP address directly.",
    });
  } else if (deviceCount === 0 && allMethods.some((method) => method.parsed > 0)) {
    advice.push({
      kind: "filtered-replies",
      title: "A recognised camera was outside this scan",
      detail:
        "Scan all connected networks, widen the entered range, or query the camera’s known IP address directly.",
    });
  }

  if (advice.length === 0) {
    advice.push({
      kind: "physical-connection",
      title: "Check the camera connection and try again",
      detail:
        "Make sure the cameras are powered and connected to the same physical switch as this computer. Quit EasyIP, then scan again or query a known IP address.",
    });
  }

  return { networks, methods, advice: advice.slice(0, 3) };
}

export function buildScanReport({
  timestamp,
  label,
  summary,
  diagnostics,
  devices,
}: {
  timestamp: string;
  label: string;
  summary: ScanSummary;
  diagnostics: ScanDiagnostics;
  devices: string[];
}): string {
  const networkLines = summary.networks.length
    ? summary.networks.map(
        (network) =>
          `${network.name}: ${network.target}${network.limited ? " (large network limited to local /24)" : ""}`,
      )
    : [label];
  const diagnosticLines = Object.entries(diagnostics).map(
    ([id, method]) =>
      `${methodNames[id] ?? id}: ${method.adapters} adapters, ${method.sent} requests sent (${method.pinned ?? 0} adapter-pinned), ${method.replies} replies, ${method.parsed} recognised${method.errors.length ? ` · errors: ${method.errors.join("; ")}` : ""}${method.sample ? ` · unrecognised reply: ${method.sample}` : ""}`,
  );
  return [
    `ptzIP scan report ${timestamp}`,
    "Read-only scan; no camera settings changed.",
    "Networks searched:",
    ...networkLines,
    "Search methods:",
    ...summary.methods.map((method) => `${method.name}: ${method.detail}`),
    ...diagnosticLines,
    "Recommended next steps:",
    ...summary.advice.map((advice) => `${advice.title}: ${advice.detail}`),
    `Devices: ${devices.join(", ") || "none"}`,
  ].join("\n");
}
