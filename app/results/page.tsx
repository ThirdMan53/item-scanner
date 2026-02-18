"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WebResult } from "@/app/api/scan/route";

interface ScanResult {
  description: string;
  valueRange: string;
  whereToBuySell: string;
  backgroundInfo: string;
  webResults: WebResult[];
}

// Subtle emerald tint at the top — matches the value card theme
const PAGE_BG: React.CSSProperties = {
  background:
    "radial-gradient(ellipse 100% 35% at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 55%), #09090b",
};

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Detect iOS/browser share API after mount (not available during SSR)
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);

    try {
      const raw = sessionStorage.getItem("scanResult");
      const img = sessionStorage.getItem("scanPreview");
      if (!raw) { setError("No scan result found."); return; }
      const parsed = JSON.parse(raw);
      if (parsed.error) { setError(parsed.error); return; }
      setResult(parsed);
      setPreview(img);
    } catch {
      setError("Failed to load scan result.");
    }
  }, []);

  const handleScanAgain = () => {
    sessionStorage.removeItem("scanResult");
    sessionStorage.removeItem("scanPreview");
    router.push("/");
  };

  const handleShare = async () => {
    if (!result || !navigator.share) return;
    try {
      // Pull the first sentence of description as a title proxy
      const title = result.description.split(/[.!?]/)[0].trim();
      await navigator.share({
        title: "Item Scanner Result",
        text: `${title}\n\nEstimated value: ${result.valueRange}`,
      });
    } catch {
      // User cancelled or share sheet unavailable — silent fail
    }
  };

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4" style={PAGE_BG}>
        <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-2">
          <AlertIcon className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-zinc-300 font-medium text-center text-base">{error}</p>
        <button
          onClick={handleScanAgain}
          className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all
            text-white font-semibold rounded-2xl px-8 py-4 text-base"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={PAGE_BG}>
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Section definitions ────────────────────────────────────────────────────

  type AnalysisKey = keyof Omit<ScanResult, "webResults">;

  const analysisSections: {
    key: AnalysisKey;
    label: string;
    icon: React.ReactNode;
    special?: boolean;
  }[] = [
    {
      key: "description",
      label: "Identification & Description",
      icon: <SearchIcon className="w-4 h-4 text-indigo-400" />,
    },
    {
      key: "valueRange",
      label: "Estimated Market Value",
      icon: <CurrencyIcon className="w-4 h-4 text-emerald-400" />,
      special: true, // gets the green glow treatment
    },
    {
      key: "whereToBuySell",
      label: "Where to Buy or Sell",
      icon: <StoreIcon className="w-4 h-4 text-amber-400" />,
    },
    {
      key: "backgroundInfo",
      label: "Background & History",
      icon: <BookIcon className="w-4 h-4 text-sky-400" />,
    },
  ];

  // ── Results screen ─────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col safe-top safe-bottom" style={PAGE_BG}>
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center gap-3 shrink-0">
        <button
          onClick={handleScanAgain}
          className="w-10 h-10 rounded-xl flex items-center justify-center
            active:scale-95 transition-transform shrink-0"
          style={{ background: "rgba(39,39,42,0.8)", border: "1px solid rgba(63,63,70,0.8)" }}
          aria-label="Back"
        >
          <ChevronLeftIcon className="w-5 h-5 text-zinc-400" />
        </button>

        <span className="flex-1 font-semibold text-zinc-100 tracking-tight">Scan Result</span>

        {/* Native share button — only rendered when navigator.share is available */}
        {canShare && (
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-xl flex items-center justify-center
              active:scale-95 transition-transform shrink-0"
            style={{ background: "rgba(39,39,42,0.8)", border: "1px solid rgba(63,63,70,0.8)" }}
            aria-label="Share result"
          >
            <ShareIcon className="w-5 h-5 text-zinc-400" />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Image preview */}
        {preview && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-zinc-900 card-in shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Scanned item" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Claude analysis cards */}
        {analysisSections.map(({ key, label, icon, special }, i) =>
          result[key] ? (
            <div
              key={key}
              className={`card-in rounded-2xl p-4 ${special ? "value-glow" : ""}`}
              style={{
                animationDelay: `${(i + 1) * 80}ms`,
                ...(special ? {} : {
                  background: "rgba(24,24,27,0.9)",
                  border: "1px solid rgba(39,39,42,0.9)",
                }),
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                  {label}
                </h2>
              </div>

              {special ? (
                /* Value range — larger, bolder, green tint */
                <p className="text-emerald-300 text-base font-semibold leading-relaxed whitespace-pre-line">
                  {result[key]}
                </p>
              ) : (
                <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-line">
                  {result[key]}
                </p>
              )}
            </div>
          ) : null
        )}

        {/* Web Results from Google Lens */}
        {result.webResults && result.webResults.length > 0 && (
          <div className="card-in" style={{ animationDelay: "400ms" }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-6 h-6 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
                <LensIcon className="w-4 h-4 text-rose-400" />
              </div>
              <h2 className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                Web Results
              </h2>
            </div>

            <div className="space-y-2">
              {result.webResults.map((item, i) => (
                <WebResultCard key={i} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Scan again — large, prominent, easy to tap */}
        <div className="card-in pt-2" style={{ animationDelay: "480ms" }}>
          <button
            onClick={handleScanAgain}
            className="w-full text-white font-semibold rounded-2xl py-5 text-base
              flex items-center justify-center gap-2
              active:scale-95 transition-transform duration-150"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 4px 24px rgba(99,102,241,0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
            }}
          >
            <ScanIcon className="w-5 h-5" />
            Scan another item
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Web result card ────────────────────────────────────────────────────────────

function WebResultCard({ item }: { item: WebResult }) {
  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform duration-150"
      style={{ background: "rgba(24,24,27,0.9)", border: "1px solid rgba(39,39,42,0.9)" }}
    >
      {item.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail}
          alt=""
          className="w-14 h-14 rounded-xl object-cover shrink-0"
          style={{ background: "rgba(39,39,42,0.8)" }}
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
          <ImageIcon className="w-6 h-6 text-zinc-600" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-zinc-200 text-sm font-medium leading-snug line-clamp-2 mb-1">
          {item.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {item.source && (
            <span className="text-zinc-500 text-xs truncate max-w-[130px]">{item.source}</span>
          )}
          {item.price && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(16,185,129,0.12)", color: "rgb(52,211,153)" }}>
              {item.price}
            </span>
          )}
        </div>
      </div>

      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1 rounded-xl px-3 py-2
            text-zinc-300 text-xs font-medium
            active:scale-95 transition-transform duration-150"
          style={{ background: "rgba(39,39,42,0.9)", border: "1px solid rgba(63,63,70,0.6)" }}
          aria-label={`View ${item.title}`}
        >
          View
          <ExternalLinkIcon className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M12 3v13m0-13 3 3m-3-3L9 6" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
    </svg>
  );
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function LensIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h6M11 8v6" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}
