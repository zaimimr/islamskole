import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Islamskole Bærum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(
    join(process.cwd(), "public/brand/logo-white.png"),
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          backgroundColor: "#4e9d3f",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #5fb04f 0, transparent 45%), radial-gradient(circle at 85% 80%, #3f8235 0, transparent 50%)",
          padding: 80,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={520} alt="" />
        <div
          style={{
            display: "flex",
            color: "#f3fce9",
            fontSize: 44,
            fontWeight: 600,
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Islamsk søndagsskole for barn i Bærum
        </div>
      </div>
    ),
    { ...size },
  );
}
