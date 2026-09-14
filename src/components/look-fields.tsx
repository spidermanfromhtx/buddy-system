import { useRef } from "react";
import { Btn } from "@/components/btn";
import { Face } from "@/components/face";
import { compressPhoto } from "@/lib/photo";
import { COLOR_THEMES, NONE, applyColorTheme, swatchFill } from "@/lib/theme";
import { cn } from "@/lib/utils";

function Swatch({
  label,
  selected,
  fill,
  onPick,
}: {
  label: string;
  selected: boolean;
  fill: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onPick}
      className={cn("size-11 rounded-full border-black", selected ? "border-[3px]" : "border")}
      style={{ background: fill }}
    />
  );
}

export function LookFields({
  name,
  color,
  photo,
  onColor,
  onPhoto,
  onDark = false,
}: {
  name: string;
  color: string;
  photo: string | null;
  onColor: (c: string) => void;
  onPhoto: (p: string | null) => void;
  onDark?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const chrome = onDark ? "night" : "line";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Face name={name || "you"} color={color} photo={photo} size="lg" />
        <p className="text-base text-muted">
          House look is cream and purple. Each color is a three-color set: primary, secondary, tertiary. A photo sits on top.
        </p>
      </div>
      <fieldset>
        <legend className="text-base font-medium">Your color</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <Swatch
            label="House colors"
            selected={!color}
            fill={swatchFill(NONE)}
            onPick={() => {
              applyColorTheme(NONE);
              onColor(NONE);
            }}
          />
          {COLOR_THEMES.map((t) => (
            <Swatch
              key={t.id}
              label={t.label}
              selected={color === t.color}
              fill={swatchFill(t.color)}
              onPick={() => {
                applyColorTheme(t.color);
                onColor(t.color);
              }}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col items-start">
        <p className="text-base font-medium" id="photo-label">
          Photo
        </p>
        <p className="mt-1 text-sm text-muted">Optional. A face photo. You can switch back to color anytime.</p>
        <input
          ref={fileRef}
          id="photo-file"
          type="file"
          accept="image/*"
          className="sr-only"
          aria-labelledby="photo-label"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            void compressPhoto(f).then(onPhoto);
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn type="button" kind={chrome} onClick={() => fileRef.current?.click()}>
            {photo ? "Change photo" : "Add photo"}
          </Btn>
          {photo ? (
            <Btn type="button" kind={chrome} onClick={() => onPhoto(null)}>
              Use color instead
            </Btn>
          ) : null}
        </div>
      </div>
    </div>
  );
}
