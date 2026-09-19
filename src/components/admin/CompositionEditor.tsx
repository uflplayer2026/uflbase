import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveBackgroundAreas } from "@/lib/assets.functions";
import type { AssetRecord } from "@/lib/assetTypes";
import {
  DEFAULT_SAFE_AREA,
  compositionStyle,
  computeComposition,
  type ProtectedArea,
  type SafeArea,
} from "@/lib/cardComposition";

const NUMS: (keyof Pick<
  SafeArea,
  "top" | "right" | "bottom" | "left" | "maxWidth" | "maxHeight"
>)[] = ["top", "right", "bottom", "left", "maxWidth", "maxHeight"];

/**
 * Admin-only safe area / protected area editor with a live
 * "background + card image = final card" preview. Guides never render for visitors.
 */
export function CompositionEditor({
  backgrounds,
  cardImages,
  onChanged,
}: {
  backgrounds: AssetRecord[];
  cardImages: AssetRecord[];
  onChanged: () => void;
}) {
  const saveFn = useServerFn(saveBackgroundAreas);
  const [backgroundId, setBackgroundId] = useState(backgrounds[0]?.id ?? "");
  const [imageId, setImageId] = useState(cardImages[0]?.id ?? "");
  const [showGuides, setShowGuides] = useState(true);
  const [safeArea, setSafeArea] = useState<SafeArea>(DEFAULT_SAFE_AREA);
  const [protectedAreas, setProtectedAreas] = useState<ProtectedArea[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const background = backgrounds.find((b) => b.id === backgroundId) ?? null;
  const image = cardImages.find((i) => i.id === imageId) ?? null;

  useEffect(() => {
    setSafeArea(background?.safeArea ?? DEFAULT_SAFE_AREA);
    setProtectedAreas(background?.protectedAreas ?? []);
  }, [background]);

  const composition = useMemo(
    () =>
      computeComposition({
        safeArea,
        protectedAreas,
        imageWidth: image?.width ?? null,
        imageHeight: image?.height ?? null,
      }),
    [safeArea, protectedAreas, image],
  );

  const save = async () => {
    if (!background) return;
    try {
      await saveFn({ data: { assetId: background.id, safeArea, protectedAreas } });
      setNotice("Composition saved — every card using this background follows it.");
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The composition could not be saved.");
    }
  };

  return (
    <section className="surface-panel">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Card composition
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="filter-label">Background</span>
          <select
            className="field focus-ring mt-1 min-h-11 w-full"
            value={backgroundId}
            onChange={(e) => setBackgroundId(e.target.value)}
          >
            <option value="">Choose background</option>
            {backgrounds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="filter-label">Preview card image</span>
          <select
            className="field focus-ring mt-1 min-h-11 w-full"
            value={imageId}
            onChange={(e) => setImageId(e.target.value)}
          >
            <option value="">None</option>
            {cardImages.slice(0, 200).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="composition-stage">
          {background ? (
            <img
              src={background.url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {image ? (
            <img src={image.url} alt={image.name} style={compositionStyle(composition)} />
          ) : null}
          {showGuides ? (
            <>
              <div
                className="composition-safe-guide"
                style={{
                  left: `${safeArea.left}%`,
                  top: `${safeArea.top}%`,
                  right: `${safeArea.right}%`,
                  bottom: `${safeArea.bottom}%`,
                }}
              />
              {protectedAreas.map((area, i) => (
                <div
                  key={`${area.label}-${i}`}
                  className="composition-protected-guide"
                  style={{
                    left: `${area.left}%`,
                    top: `${area.top}%`,
                    right: `${area.right}%`,
                    bottom: `${area.bottom}%`,
                  }}
                />
              ))}
            </>
          ) : null}
        </div>

        <div className="min-w-56 flex-1 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
            />
            Show safe / protected guides (admin only)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {NUMS.map((key) => (
              <label key={key} className="block text-sm">
                <span className="filter-label">{key}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field focus-ring mt-1 min-h-11 w-full"
                  value={safeArea[key]}
                  onChange={(e) =>
                    setSafeArea((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
                  }
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="filter-label">Align X</span>
              <select
                className="field focus-ring mt-1 min-h-11 w-full"
                value={safeArea.alignX}
                onChange={(e) =>
                  setSafeArea((prev) => ({ ...prev, alignX: e.target.value as SafeArea["alignX"] }))
                }
              >
                <option value="start">Left</option>
                <option value="center">Center</option>
                <option value="end">Right</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="filter-label">Align Y</span>
              <select
                className="field focus-ring mt-1 min-h-11 w-full"
                value={safeArea.alignY}
                onChange={(e) =>
                  setSafeArea((prev) => ({ ...prev, alignY: e.target.value as SafeArea["alignY"] }))
                }
              >
                <option value="start">Top</option>
                <option value="center">Middle</option>
                <option value="end">Bottom</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            {protectedAreas.map((area, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <input
                  className="field focus-ring min-h-11 flex-1"
                  value={area.label}
                  onChange={(e) =>
                    setProtectedAreas((prev) =>
                      prev.map((a, i) => (i === index ? { ...a, label: e.target.value } : a)),
                    )
                  }
                />
                {(["top", "right", "bottom", "left"] as const).map((k) => (
                  <input
                    key={k}
                    type="number"
                    min={0}
                    max={100}
                    aria-label={`${area.label} ${k}`}
                    className="field focus-ring min-h-11 w-16"
                    value={area[k]}
                    onChange={(e) =>
                      setProtectedAreas((prev) =>
                        prev.map((a, i) =>
                          i === index ? { ...a, [k]: Number(e.target.value) || 0 } : a,
                        ),
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  className="btn-secondary min-h-11 px-3 text-xs"
                  onClick={() => setProtectedAreas((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setProtectedAreas((prev) => [
                  ...prev,
                  { label: "Protected area", top: 70, right: 5, bottom: 5, left: 5 },
                ])
              }
            >
              Add protected area
            </button>
          </div>

          <button type="button" className="btn-primary" disabled={!background} onClick={save}>
            Save composition
          </button>
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </div>
      </div>
    </section>
  );
}
