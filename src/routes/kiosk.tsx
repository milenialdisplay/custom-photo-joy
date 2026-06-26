import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kiosk")({
  beforeLoad: () => {
    throw redirect({ to: "/event" });
  },
  component: () => null,
});
