import { createFileRoute } from "@tanstack/react-router";
import CameraFinder from "@/components/camera-finder";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ptzIP — Multi-brand Network Discovery" },
      {
        name: "description",
        content:
          "Discover PTZ, cinema and studio cameras. Inspect network details, access web remotes and export production camera patch sheets.",
      },
      { property: "og:title", content: "ptzIP — Multi-brand Network Discovery" },
      {
        property: "og:description",
        content: "A production workspace for multi-brand camera discovery and camera patch sheets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CameraFinder,
});
