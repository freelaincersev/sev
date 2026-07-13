import { ImageResponse } from "next/og";

// Open Graph card shown when a Sev link is shared (KakaoTalk, Slack, X, …).
// Generated in code — no image asset to maintain, brand indigo (#4f46e5).
export const alt = "Sev — user-owned AI memory layer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#0b0b12",
          backgroundImage:
            "radial-gradient(circle at 78% 12%, #4f46e5 0%, transparent 46%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 4,
            color: "#a5b4fc",
          }}
        >
          SEV · USER-OWNED AI MEMORY LAYER
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            Stop re-explaining yourself to every AI.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              color: "#c7cbd4",
              marginTop: 28,
              maxWidth: 940,
            }}
          >
            A portable AI memory layer you own — works with ChatGPT, Claude,
            and Gemini.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", fontWeight: 700, color: "#818cf8" }}>
            Sev
          </div>
          <div style={{ display: "flex", color: "#8b90a0" }}>
            LLMs change. Your context stays.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
