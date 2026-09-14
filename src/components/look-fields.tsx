import { useRef } from "react";
import { Btn } from "@/components/btn";
import { Face } from "@/components/face";
import { compressPhoto } from "@/lib/photo";
import { COLORS, HOUSE, NONE, applyColorTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

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
          House look is cream and coral. Pick another color if you want the app and your face to follow it. A photo sits on top.
        </p>
      </div>
      <fieldset>
        <legend className="text-base font-medium">Your color</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="House colors"
            aria-pressed={!color}
            title="House"
            onClick={() => {
              applyColorTheme(NONE);
              onColor(NONE);
            }}
            className={cn(
              "size-11 overflow-hidden rounded-full border-2",
              !color ? (onDark ? "border-paper" : "border-ink") : "border-transparent",
            )}
            style={{
              background: `conic-gradient(from 210deg, ${HOUSE} 0 55%, #d4ead8 55% 78%, #f5f2ec 78% 100%)`,
            }}
          />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => {
                applyColorTheme(c);
                onColor(c);
              }}
              className={cn(
                "size-11 rounded-full border-2",
                color === c ? (onDark ? "border-paper" : "border-ink") : "border-transparent",
              )}
              style={{ backgroundColor: c }}
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
