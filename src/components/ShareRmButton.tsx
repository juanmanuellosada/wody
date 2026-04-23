"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { GymTerms } from "@/lib/gym-terms";
import { GYM_LOGOS_SQUARE } from "@/lib/gym-logos";

import wodyTextoSrc from "@/logos/wody-texto.png";

interface ShareRmButtonProps {
  exercise: string;
  weight: number;
  date: string;
  athleteName: string;
  gymName: string;
  gymSlug: string;
  terms: GymTerms;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function getAccentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-red').trim() || '#E31414';
}

async function generateRmImage(
  exercise: string,
  weight: number,
  date: string,
  athleteName: string,
  gymName: string,
  gymLogoSrc: string | null
): Promise<Blob> {
  const accent = getAccentColor();

  const [wodyImg, gymLogoImg] = await Promise.all([
    loadImage(wodyTextoSrc.src),
    gymLogoSrc ? loadImage(gymLogoSrc) : Promise.resolve(null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 1080, 1080);

  // Diagonal stripe pattern
  ctx.strokeStyle = `${accent}0F`;
  ctx.lineWidth = 1;
  for (let i = -1080; i < 2160; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 1080, 1080);
    ctx.stroke();
  }

  // Top-left: gym logo (or name fallback)
  if (gymLogoImg) {
    const h = 80;
    const w = (gymLogoImg.width / gymLogoImg.height) * h;
    ctx.drawImage(gymLogoImg, 80, 60, w, h);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 36px sans-serif";
    ctx.letterSpacing = "2px";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(gymName.toUpperCase(), 80, 100);
    ctx.textBaseline = "alphabetic";
  }

  // WODY text logo — draw at top-right
  const wodyH = 28;
  const wodyW = (wodyImg.width / wodyImg.height) * wodyH;
  ctx.drawImage(wodyImg, 1000 - wodyW, 85, wodyW, wodyH);

  // Red accent line below logos
  ctx.fillStyle = accent;
  ctx.fillRect(80, 160, 920, 2);

  // "NUEVO RECORD" label
  ctx.fillStyle = accent;
  ctx.font = "bold 28px sans-serif";
  ctx.letterSpacing = "8px";
  ctx.textAlign = "left";
  ctx.fillText("NUEVO RECORD", 80, 220);

  // Exercise name — large
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 72px sans-serif";
  ctx.letterSpacing = "2px";
  const exerciseUpper = exercise.toUpperCase();
  const maxWidth = 920;
  const words = exerciseUpper.split(" ");
  let line = "";
  let y = 340;
  for (const word of words) {
    const testLine = line ? line + " " + word : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, 80, y);
      line = word;
      y += 85;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 80, y);

  // Weight — huge red number
  ctx.fillStyle = accent;
  ctx.font = "900 220px sans-serif";
  ctx.letterSpacing = "0px";
  const weightStr = weight % 1 === 0 ? weight.toString() : weight.toFixed(1);
  ctx.fillText(weightStr, 70, y + 250);

  // "KG" unit
  ctx.font = "900 220px sans-serif";
  const bigWidth = ctx.measureText(weightStr).width;
  ctx.fillStyle = "#666666";
  ctx.font = "bold 60px sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("KG", 70 + bigWidth + 15, y + 250);

  // Bottom separator
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(80, 900, 920, 1);

  // Athlete name + date (left)
  ctx.fillStyle = "#888888";
  ctx.font = "bold 24px sans-serif";
  ctx.letterSpacing = "6px";
  ctx.textAlign = "left";
  ctx.fillText(athleteName.toUpperCase(), 80, 950);

  ctx.fillStyle = "#555555";
  ctx.font = "24px sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(date, 80, 985);

  // Bottom-right: gym logo small (or name fallback)
  if (gymLogoImg) {
    const h = 50;
    const w = (gymLogoImg.width / gymLogoImg.height) * h;
    ctx.drawImage(gymLogoImg, 1000 - w, 935, w, h);
  } else {
    ctx.fillStyle = "#888888";
    ctx.font = "bold 20px sans-serif";
    ctx.letterSpacing = "4px";
    ctx.textAlign = "right";
    ctx.fillText(gymName.toUpperCase(), 1000, 970);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export function ShareRmButton({ exercise, weight, date, athleteName, gymName, gymSlug, terms }: ShareRmButtonProps) {
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const gymLogoSrc = GYM_LOGOS_SQUARE[gymSlug]?.src ?? null;
      const blob = await generateRmImage(exercise, weight, date, athleteName, gymName, gymLogoSrc);
      const file = new File([blob], `rm-${exercise.toLowerCase().replace(/\s+/g, "-")}.png`, {
        type: "image/png",
      });

      const shareText = `Nuevo ${terms.rm} en ${exercise}: ${weight}kg - ${gymName}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          text: shareText,
          files: [file],
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    } finally {
      setSharing(false);
    }
  }, [exercise, weight, date, athleteName, gymName, gymSlug, terms]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      loading={sharing}
      title="Compartir"
    >
      Compartir
    </Button>
  );
}
