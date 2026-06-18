"use client";

import { useMemo, useState } from "react";
import { encodeQr, qrToSvgPath } from "@/lib/qr";
import { QrIcon } from "./Icons";
import { useT } from "./I18nProvider";

const QUIET = 4; // quiet-zone modules required by the QR spec

/**
 * Owner-facing share QR. Encodes `url` (the public share link) entirely on the
 * client via the dependency-free encoder in lib/qr — no network, nothing leaks.
 * Renders as crisp inline SVG; download rasterizes that same matrix to a PNG.
 */
export function QrShare({ url }: { url: string }) {
  const m = useT().chrome;
  const [open, setOpen] = useState(false);

  const { modules, dim } = useMemo(() => {
    const mods = encodeQr(url);
    return { modules: mods, dim: mods.length + QUIET * 2 };
  }, [url]);

  function download() {
    const scale = 12;
    const px = dim * scale;
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < modules.length; y++) {
      for (let x = 0; x < modules[y].length; x++) {
        if (modules[y][x]) {
          ctx.fillRect((x + QUIET) * scale, (y + QUIET) * scale, scale, scale);
        }
      }
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "myvouch-qr.png";
    a.click();
  }

  return (
    <div className="qr-share">
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <QrIcon className="ic" />
        {open ? m.hideQr : m.showQr}
      </button>

      {open && (
        <div className="qr-panel">
          <svg
            className="qr-svg"
            viewBox={`0 0 ${dim} ${dim}`}
            role="img"
            aria-label={m.qrAlt}
            shapeRendering="crispEdges"
          >
            <rect width={dim} height={dim} fill="#fff" />
            <path
              d={qrToSvgPath(modules)}
              transform={`translate(${QUIET} ${QUIET})`}
              fill="#000"
            />
          </svg>
          <p className="qr-caption">{m.qrCaption}</p>
          <button className="btn btn-primary btn-sm" onClick={download}>
            {m.downloadQr}
          </button>
        </div>
      )}
    </div>
  );
}
