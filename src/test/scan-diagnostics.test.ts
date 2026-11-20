import { describe, expect, it } from "vitest";
import { summariseScan, type ScanMethod } from "@/lib/scan-diagnostics";

const quiet: ScanMethod = {
  adapters: 1,
  sent: 2,
  replies: 0,
  parsed: 0,
  errors: [],
  sample: "",
};
const network = { name: "en7", target: "192.168.2.0/24", limited: false };

describe("zero-camera scan diagnosis", () => {
  it("identifies a busy Panasonic reply port as a tool conflict", () => {
    const summary = summariseScan({
      automatic: true,
      networks: [network],
      diagnostics: {
        panasonic: { ...quiet, sent: 0, errors: ["0.0.0.0 port 10669: EADDRINUSE"] },
        sony: quiet,
      },
      deviceCount: 0,
    });
    expect(summary.advice.map((advice) => advice.kind)).toContain("port-conflict");
    expect(summary.methods.find((method) => method.id === "panasonic")?.attention).toBe(true);
  });

  it("does not blame a missing network for request failures", () => {
    const summary = summariseScan({
      automatic: true,
      networks: [],
      diagnostics: {
        panasonic: { ...quiet, adapters: 0, sent: 0 },
        sony: { ...quiet, adapters: 0, sent: 0 },
      },
      deviceCount: 0,
    });
    expect(summary.advice.map((advice) => advice.kind)).toEqual(["no-network"]);
  });

  it("flags replies that could not be recognised", () => {
    const summary = summariseScan({
      automatic: true,
      networks: [network],
      diagnostics: { panasonic: { ...quiet, replies: 2 }, sony: quiet },
      deviceCount: 0,
    });
    expect(summary.advice.map((advice) => advice.kind)).toContain("unrecognised-replies");
  });

  it("distinguishes recognised replies filtered out by the selected range", () => {
    const summary = summariseScan({
      automatic: false,
      networks: [],
      diagnostics: { panasonic: { ...quiet, replies: 1, parsed: 1 }, sony: quiet },
      deviceCount: 0,
    });
    expect(summary.advice.map((advice) => advice.kind)).toEqual(["filtered-replies"]);
  });

  it("recommends checking the physical connection after a quiet completed scan", () => {
    const summary = summariseScan({
      automatic: true,
      networks: [network],
      diagnostics: { panasonic: quiet, sony: quiet },
      deviceCount: 0,
    });
    expect(summary.advice.map((advice) => advice.kind)).toEqual(["physical-connection"]);
    expect(summary.networks).toEqual([network]);
  });
});
