"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";

import wodyTextoSrc from "@/logos/wody-texto.png";
import unidosLogoSrc from "@/logos/unidos-logo-completo.png";

interface ShareRmButtonProps {
  exercise: string;
  weight: number;
  date: string;
  athleteName: string;
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

async function generateRmImage(
  exercise: string,
  weight: number,
  date: string,
  athleteName: string
): Promise<Blob> {
  // Load logos
  const [wodyImg, unidosImg] = await Promise.all([
    loadImage(wodyTextoSrc.src),
    loadImage(unidosLogoSrc.src),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 1080, 1080);

  // Diagonal stripe pattern
  ctx.strokeStyle = "rgba(227, 20, 20, 0.06)";
  ctx.lineWidth = 1;
  for (let i = -1080; i < 2160; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 1080, 1080);
    ctx.stroke();
  }

  // Top: Unidos logo (left) + WODY logo (right)
  // Unidos logo — draw at top-left
  const unidosH = 80;
  const unidosW = (unidosImg.width / unidosImg.height) * unidosH;
  ctx.drawImage(unidosImg, 80, 60, unidosW, unidosH);

  // WODY text logo — draw at top-right
  const wodyH = 28;
  const wodyW = (wodyImg.width / wodyImg.height) * wodyH;
  ctx.drawImage(wodyImg, 1000 - wodyW, 85, wodyW, wodyH);

  // Red accent line below logos
  ctx.fillStyle = "#E31414";
  ctx.fillRect(80, 160, 920, 2);

  // "NUEVO RECORD" label
  ctx.fillStyle = "#E31414";
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
  ctx.fillStyle = "#E31414";
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

  // Bottom-right: Unidos logo small
  const smallUnidosH = 50;
  const smallUnidosW = (unidosImg.width / unidosImg.height) * smallUnidosH;
  ctx.drawImage(unidosImg, 1000 - smallUnidosW, 935, smallUnidosW, smallUnidosH);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export function ShareRmButton({ exercise, weight, date, athleteName }: ShareRmButtonProps) {
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await generateRmImage(exercise, weight, date, athleteName);
      const file = new File([blob], `rm-${exercise.toLowerCase().replace(/\s+/g, "-")}.png`, {
        type: "image/png",
      });

      const shareText = `Nuevo RM en ${exercise}: ${weight}kg - Unidos Garage CrossFit`;

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
  }, [exercise, weight, date, athleteName]);

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
