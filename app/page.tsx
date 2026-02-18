"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const STATUS_MESSAGES = [
  "Identifying item...",
  "Researching value...",
  "Finding where to buy...",
  "Gathering history...",
];

// Subtle radial gradient that adds depth without distracting from content
const PAGE_BG: React.CSSProperties = {
  background:
    "radial-gradient(ellipse 120% 55% at 50% -5%, rgba(99,102,241,0.10) 0%, transparent 65%), #09090b",
};

const LOADING_BG: React.CSSProperties = {
  background:
    "radial-gradient(ellipse 100% 50% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%), #09090b",
};

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);

  // Cycle status messages while loading
  useEffect(() => {
    if (!isLoading) { setStatusIdx(0); return; }
    const id = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length),
      2000
    );
    return () => clearInterval(id);
  }, [isLoading]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setIsLoading(true);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType: file.type }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

        sessionStorage.setItem("scanResult", JSON.stringify(data));
        sessionStorage.setItem("scanPreview", objectUrl);
        router.push("/results");
      } catch (err) {
        setIsLoading(false);
        setPreview(null);
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        alert(`Scan failed: ${msg}`);
      }
    },
    [router]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const openCamera = () => {
    fileInputRef.current?.setAttribute("capture", "environment");
    fileInputRef.current?.click();
  };

  const openGallery = () => {
    fileInputRef.current?.removeAttribute("capture");
    fileInputRef.current?.click();
  };

  // ── Loading screen ───────────────────────────────────────────────────────

  if (isLoading && preview) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 gap-8"
        style={LOADING_BG}
      >
        {/* Preview image with animated scan overlay */}
        <div className="relative w-72 h-72 rounded-3xl overflow-hidden shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Scanning"
            className="w-full h-full object-cover"
            style={{ filter: "brightness(0.55) saturate(0.8)" }}
          />

          {/* Scan lines — primary + secondary offset by 1s */}
          <div className="scan-sweep   absolute left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(129,140,248,0.9) 30%, rgba(165,180,252,1) 50%, rgba(129,140,248,0.9) 70%, transparent 100%)", boxShadow: "0 0 12px 4px rgba(129,140,248,0.55)" }} />
          <div className="scan-sweep-2 absolute left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(129,140,248,0.5) 30%, rgba(165,180,252,0.7) 50%, rgba(129,140,248,0.5) 70%, transparent 100%)", boxShadow: "0 0 8px 2px rgba(129,140,248,0.3)" }} />

          {/* Corner brackets */}
          <div className="corner-pulse absolute inset-0 pointer-events-none">
            <span className="absolute top-4 left-4  w-8 h-8 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm" />
            <span className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm" />
            <span className="absolute bottom-4 left-4  w-8 h-8 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm" />
            <span className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-indigo-400 rounded-br-sm" />
          </div>

          {/* Dark vignette */}
          <div className="absolute inset-0 rounded-3xl"
            style={{ background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)" }} />
        </div>

        {/* Cycling status message — key change re-mounts the element, replaying the CSS anim */}
        <div className="text-center space-y-3">
          <p
            key={statusIdx}
            className="status-in text-zinc-200 text-lg font-medium tracking-tight"
          >
            {STATUS_MESSAGES[statusIdx]}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {STATUS_MESSAGES.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-500"
                style={{
                  width:  i === statusIdx ? "20px" : "6px",
                  height: "6px",
                  background: i === statusIdx ? "rgb(129,140,248)" : "rgb(63,63,70)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Home screen ──────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col safe-top safe-bottom" style={PAGE_BG}>
      {/* Header */}
      <header className="px-6 pt-2 pb-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.45)]">
          <ScanIcon className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-zinc-100 tracking-tight">Item Scanner</span>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 gap-10">

        {/* Title + tagline */}
        <div className="text-center card-in">
          <h1 className="text-4xl font-bold text-zinc-100 tracking-tight mb-2">
            Point. Scan. Know.
          </h1>
          <p className="text-zinc-400 text-base max-w-[260px] mx-auto leading-relaxed">
            Identify any item, get its value, and find where to buy or sell it.
          </p>
        </div>

        {/* Camera button with pulse rings */}
        <div className="relative card-in" style={{ animationDelay: "80ms" }}>
          {/* Expanding pulse rings — both scale from the button's own bounds */}
          <div className="camera-ring   absolute inset-0 rounded-3xl border-2 border-indigo-500/35 pointer-events-none" />
          <div className="camera-ring-2 absolute inset-0 rounded-3xl border   border-indigo-400/20 pointer-events-none" />

          <div
            className={`relative w-64 h-64 rounded-3xl cursor-pointer select-none transition-transform duration-150
              ${isDragging ? "scale-105" : "active:scale-95"}`}
            style={{
              background: isDragging
                ? "rgba(99,102,241,0.18)"
                : "linear-gradient(145deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.04) 100%)",
              border: isDragging
                ? "2px solid rgba(129,140,248,0.7)"
                : "1px solid rgba(99,102,241,0.20)",
              boxShadow: "0 0 40px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={openCamera}
            role="button"
            aria-label="Open camera to scan item"
          >
            {/* Viewfinder corners */}
            <div className="absolute inset-5 pointer-events-none">
              <span className="absolute top-0 left-0  w-7 h-7 border-t-2 border-l-2 border-indigo-400/70 rounded-tl-sm" />
              <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-indigo-400/70 rounded-tr-sm" />
              <span className="absolute bottom-0 left-0  w-7 h-7 border-b-2 border-l-2 border-indigo-400/70 rounded-bl-sm" />
              <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-indigo-400/70 rounded-br-sm" />
            </div>

            {/* Center icon + label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.15)", boxShadow: "0 0 24px rgba(99,102,241,0.2)" }}>
                <CameraIcon className="w-10 h-10 text-indigo-300" />
              </div>
              <div className="text-center">
                <p className="text-zinc-200 text-base font-semibold">
                  {isDragging ? "Drop to scan" : "Tap to scan"}
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">Camera or drop an image</p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-xs card-in" style={{ animationDelay: "140ms" }}>
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-xs uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Gallery button — secondary action, clearly visible */}
        <button
          onClick={openGallery}
          className="flex items-center gap-3 w-full max-w-xs rounded-2xl px-5 py-4
            text-zinc-300 text-base font-medium
            active:scale-95 transition-transform duration-150 card-in"
          style={{
            animationDelay: "180ms",
            background: "rgba(39,39,42,0.7)",
            border: "1px solid rgba(63,63,70,0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          <GalleryIcon className="w-5 h-5 text-zinc-400 shrink-0" />
          Choose from library
        </button>
      </section>

      {/* Footer */}
      <footer className="px-6 pb-2 text-center">
        <p className="text-zinc-600 text-xs">Works with products, plants, books &amp; more</p>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </main>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  );
}

function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}
