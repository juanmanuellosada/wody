"use client";

import { useRef, useState, useTransition } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/Button";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

interface ShareWodButtonProps {
  title: string;
  content: string;
  dateLabel: string;
  gymName?: string;
}

export function ShareWodButton({ title, content, dateLabel, gymName }: ShareWodButtonProps) {
  const [generating, setGenerating] = useState(false);
  const hiddenRef = useRef<HTMLDivElement>(null);

  async function handleShare() {
    if (!hiddenRef.current) return;
    setGenerating(true);

    try {
      // Make the hidden element visible for capture
      const el = hiddenRef.current;
      el.style.display = "block";

      const dataUrl = await toPng(el, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0A0A0A",
      });

      el.style.display = "none";

      // Convert to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${title}-${dateLabel}.png`, { type: "image/png" });

      // Try Web Share API (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${title} — ${dateLabel}`,
          files: [file],
        });
      } else {
        // Fallback: download
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${title}-${dateLabel}.png`;
        link.click();
      }
    } catch (err) {
      // User cancelled share or error
      if (hiddenRef.current) hiddenRef.current.style.display = "none";
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleShare} loading={generating}>
        {generating ? "Generando..." : "Compartir"}
      </Button>

      {/* Hidden render target for image capture */}
      <div
        ref={hiddenRef}
        style={{ display: "none", position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}
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
                backgroundColor: "#E31414",
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
              color: "#E31414",
              margin: 0,
            }}>
              {dateLabel}
            </p>
          </div>

          {/* Separator */}
          <div style={{
            width: 48,
            height: 3,
            backgroundColor: "#E31414",
            marginBottom: 20,
          }} />

          {/* Content */}
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <MarkdownRenderer content={content} className="text-sm" />
          </div>

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
              color: "#E31414",
            }}>
              wody.com.ar
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
