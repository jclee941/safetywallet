import { useCallback, useRef, useState } from "react";

interface UseSignatureCanvasOptions {
  width?: number;
  height?: number;
}

export function useSignatureCanvas(options: UseSignatureCanvasOptions = {}) {
  const { width = 600, height = 240 } = options;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }, []);

  const startDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      setIsDrawing(true);
    },
    [],
  );

  const drawSignature = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasStroke(true);
    },
    [isDrawing],
  );

  const endDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const getCanvasDataUrl = useCallback((): string | null => {
    return canvasRef.current?.toDataURL("image/png") ?? null;
  }, []);

  return {
    canvasRef,
    canvasProps: {
      width,
      height,
      className: "w-full bg-background",
      onPointerDown: startDrawing,
      onPointerMove: drawSignature,
      onPointerUp: endDrawing,
      onPointerLeave: endDrawing,
    },
    isDrawing,
    hasStroke,
    clearSignature,
    getCanvasDataUrl,
  };
}
