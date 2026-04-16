"use client";

import { useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { Button } from "@/components/ui/Button";
import { markdownToHtml, normalizeContent } from "@/components/ui/MarkdownRenderer";

interface ShareWodButtonProps {
  title: string;
  content: string;
  dateLabel: string;
  gymName?: string;
}

const CAPTURE_STYLES = `
.wod-capture, .wod-capture * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.wod-capture p { margin: 6px 0; color: #D1D5DB; font-size: 14px; line-height: 1.6; }
.wod-capture strong { color: #FFFFFF; font-weight: 700; }
.wod-capture em { color: #D1D5DB; font-style: italic; }
.wod-capture h1 { color: #FFFFFF; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin: 12px 0 4px; }
.wod-capture h2 { color: #FFFFFF; font-size: 17px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 10px 0 4px; }
.wod-capture h3 { color: #FFFFFF; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin: 8px 0 4px; }
.wod-capture ul { margin: 6px 0; padding-left: 20px; color: #D1D5DB; list-style: disc; }
.wod-capture ol { margin: 6px 0; padding-left: 20px; color: #D1D5DB; list-style: decimal; }
.wod-capture li { margin: 2px 0; font-size: 14px; line-height: 1.6; }
`;

export function ShareWodButton({ title, content, dateLabel, gymName }: ShareWodButtonProps) {
  const [generating, setGenerating] = useState(false);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const contentHtml = markdownToHtml(normalizeContent(content));

  async function generateImage(): Promise<string | null> {
    if (!hiddenRef.current) return null;
    const el = hiddenRef.current;
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    const dataUrl = await domToPng(el, {
      quality: 1,
      scale: 2,
      backgroundColor: "#0A0A0A",
    });
    return dataUrl;
  }

  async function handleShare() {
    setGenerating(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${title}-${dateLabel}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${title} — ${dateLabel}`, files: [file] });
      }
    } catch { /* user cancelled */ }
    finally { setGenerating(false); }
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${title}-${dateLabel}.png`;
      link.click();
    } catch { /* error */ }
    finally { setGenerating(false); }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleShare} loading={generating}>
          Compartir
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownload} disabled={generating}>
          Descargar
        </Button>
      </div>

      {/* Hidden render target for image capture — stays in layout tree off-screen */}
      <div
        ref={hiddenRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div
          style={{
            width: 420,
            padding: 32,
            backgroundColor: "#0A0A0A",
            color: "white",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}>
              <div style={{
                width: 4,
                height: 24,
                backgroundColor: "var(--color-red, #E31414)",
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 20,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "white",
              }}>
                {title}
              </span>
            </div>
            <p style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--color-red, #E31414)",
              margin: 0,
            }}>
              {dateLabel}
            </p>
          </div>

          {/* Separator */}
          <div style={{
            width: 48,
            height: 3,
            backgroundColor: "var(--color-red, #E31414)",
            marginBottom: 20,
          }} />

          {/* Content */}
          <style dangerouslySetInnerHTML={{ __html: CAPTURE_STYLES }} />
          <div
            className="wod-capture"
            style={{ fontSize: 14, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* Footer */}
          <div style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid #1A1A1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#666",
            }}>
              {gymName ?? "WODY"}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "var(--color-red, #E31414)",
            }}>
              wody.com.ar
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
