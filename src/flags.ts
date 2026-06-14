import { flag } from "flags/next";

export const emailNotifications = flag<boolean>({
  key: "email-notifications",
  description: "Send e-postvarsler for påmeldinger og lærersøknader",
  defaultValue: false,
  options: [
    { value: true, label: "På" },
    { value: false, label: "Av" },
  ],
  async decide() {
    try {
      const { get } = await import("@vercel/edge-config");
      const value = await get<boolean>("email-notifications");
      if (typeof value === "boolean") return value;
    } catch {
      void 0;
    }
    return process.env.EMAILS_ENABLED === "true";
  },
});
