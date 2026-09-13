export type CallSearch = {
  dummy?: boolean;
  name?: string;
  color?: string;
  task?: string;
  urgent?: boolean;
  lengthMin?: number;
  camera?: boolean;
  allowCamera?: boolean;
  room?: string;
  bothRing?: boolean;
};

function asBool(v: unknown): boolean | undefined {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
}

export function parseCallSearch(raw: Record<string, unknown>): CallSearch {
  const n = raw.lengthMin;
  const lengthMin =
    n === undefined || n === "" || n === null ? undefined : Number(n);
  return {
    dummy: asBool(raw.dummy),
    name: typeof raw.name === "string" ? raw.name : undefined,
    color: typeof raw.color === "string" ? raw.color : undefined,
    task: typeof raw.task === "string" ? raw.task : undefined,
    urgent: asBool(raw.urgent),
    lengthMin: Number.isFinite(lengthMin) ? lengthMin : undefined,
    camera: asBool(raw.camera),
    allowCamera: asBool(raw.allowCamera),
    room: typeof raw.room === "string" ? raw.room : undefined,
    bothRing: asBool(raw.bothRing),
  };
}
