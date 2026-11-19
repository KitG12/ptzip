import { describe, expect, it } from "vitest";
import { demoCameras, validateChange, networkSchema, mask } from "@/lib/cameras";
describe("Camera network rules", () => {
  const ptz = demoCameras[2];
  const cinema = demoCameras[0];
  if (!ptz || !cinema) throw new Error("Required production fixtures are missing.");
  it("never rewrites cinema network settings", () => {
    expect(() => validateChange(cinema, cinema, demoCameras)).toThrow("Only PTZ");
  });
  it("rejects an existing camera IP collision", () => {
    expect(() => validateChange(ptz, { ...ptz, ip: "192.168.1.85" }, demoCameras)).toThrow(
      "IP collision",
    );
  });
  it("validates all octets", () => {
    expect(networkSchema.safeParse({ ...ptz, ip: "192.168.1.256" }).success).toBe(false);
  });
  it("supports a valid PTZ change", () => {
    expect(validateChange(ptz, { ...ptz, ip: "192.168.1.155" }, demoCameras).ip).toBe(
      "192.168.1.155",
    );
  });
  it("maps /24 to the specified subnet mask", () => {
    expect(mask(24)).toBe("255.255.255.0");
  });
  it("rejects broadcast addresses", () => {
    expect(() => validateChange(ptz, { ...ptz, ip: "192.168.1.255" }, demoCameras)).toThrow(
      "broadcast",
    );
  });
});
