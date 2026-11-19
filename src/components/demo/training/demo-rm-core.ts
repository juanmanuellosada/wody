import type {
  DemoRmActorToken,
  DemoRmCoreConfig,
  DemoRmKind,
  DemoRmLedgerRow,
  DemoRmProjectionResult,
  DemoRmResult,
  DemoRmState,
} from "./demo-rm-types";

const VERSION = 1 as const;
const NOT_AUTHORIZED = "No autorizado.";
const INVALID_STATE = "El estado de PRs no es valido.";
const EMPTY_EXERCISE = "El ejercicio no puede estar vacio.";
const INVALID_WEIGHT = "El peso debe ser mayor a 0.";
const EMPTY_DATE = "La fecha es obligatoria.";
const INVALID_DATE = "La fecha no es valida.";

type Transition = { state: unknown; result: DemoRmResult };
type ParsedCommand = { id: string; exercise: string; weight: string; date: string };

function closedDataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  // This guard is deliberately limited to hostile runtime-shape reflection.
  // Authorized core dependencies are not executed or caught here.
  try {
    if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== keys.length || Object.getOwnPropertySymbols(value).length !== 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      if (!names.includes(key)) return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

function closedArray(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length !== 0) return null;
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || !names.includes("length")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return null;
  }
}

function namespaceFor(kind: DemoRmKind): string | null {
  if (kind === "GYM") return "demo-gym-rms/v1";
  if (kind === "PERSONAL") return "demo-personal-rms/v1";
  return null;
}

function rmNotFound(): string {
  // Both supported kinds use the production PR terminology.
  return "PR no encontrado.";
}

function normalizedDate(raw: string): { value: string } | { error: string } {
  if (raw === "") return { error: EMPTY_DATE };
  const date = new Date(raw + "T00:00:00.000Z");
  // The server action lets Prisma receive these values. This in-memory ledger is stricter:
  // finite values and valid dates are required so its serializable state remains valid.
  if (!Number.isFinite(date.getTime())) return { error: INVALID_DATE };
  return { value: date.toISOString().slice(0, 10) };
}

function parseFields(command: ParsedCommand): { value: Omit<DemoRmLedgerRow, "studentId"> } | { error: string } {
  const exercise = command.exercise.trim();
  if (!exercise) return { error: EMPTY_EXERCISE };
  const weight = parseFloat(command.weight);
  // Intentionally preserve parseFloat prefix parsing (for example, "80kg" is 80),
  // while preventing non-serializable Infinity/NaN values in demo state.
  if (!Number.isFinite(weight) || weight <= 0) return { error: INVALID_WEIGHT };
  const date = normalizedDate(command.date);
  if ("error" in date) return date;
  return { value: { id: command.id, exercise, weight, date: date.value } };
}

function readCommand(value: unknown): ParsedCommand | null {
  const record = closedDataRecord(value, ["id", "exercise", "weight", "date"]);
  if (!record || typeof record.id !== "string" || typeof record.exercise !== "string" || typeof record.weight !== "string" || typeof record.date !== "string") return null;
  return { id: record.id, exercise: record.exercise, weight: record.weight, date: record.date };
}

function isValidId(value: string): boolean {
  return value.trim().length > 0;
}

function readRow(value: unknown, ownerIds: ReadonlySet<string>): DemoRmLedgerRow | null {
  const row = closedDataRecord(value, ["id", "studentId", "exercise", "weight", "date"]);
  if (!row || typeof row.id !== "string" || typeof row.studentId !== "string" || typeof row.exercise !== "string" || typeof row.weight !== "number" || typeof row.date !== "string") return null;
  if (!isValidId(row.id) || !ownerIds.has(row.studentId) || row.exercise.trim() !== row.exercise || row.exercise === "" || !Number.isFinite(row.weight) || row.weight <= 0) return null;
  const date = normalizedDate(row.date);
  if ("error" in date || date.value !== row.date) return null;
  return { id: row.id, studentId: row.studentId, exercise: row.exercise, weight: row.weight, date: row.date };
}

/**
 * Creates one intentionally small, opaque-capability RM ledger for either GYM or PERSONAL.
 * The supplied owner list is trusted scenario composition, copied and frozen inside the closure;
 * it is never persisted or exported as command-time authorization data.
 */
export function createDemoRmCore(config: DemoRmCoreConfig) {
  const configRecord = closedDataRecord(config, ["kind", "ownerIds"]);
  if (!configRecord || (configRecord.kind !== "GYM" && configRecord.kind !== "PERSONAL")) throw new TypeError("Invalid demo RM core configuration.");
  const ownerValues = closedArray(configRecord.ownerIds);
  if (!ownerValues || ownerValues.some((id) => typeof id !== "string" || !isValidId(id))) throw new TypeError("Invalid demo RM owner configuration.");
  const frozenOwnerIds = Object.freeze([...(ownerValues as string[])]);
  const ownerIds = new Set(frozenOwnerIds);
  if (ownerIds.size !== frozenOwnerIds.length) throw new TypeError("Duplicate demo RM owner configuration.");
  const kind = configRecord.kind as DemoRmKind;
  const namespaceValue = namespaceFor(kind);
  if (!namespaceValue) throw new TypeError("Invalid demo RM kind.");
  const namespace: string = namespaceValue;

  const tokens = new WeakSet<object>();
  const ownerByToken = new WeakMap<object, string>();
  const tokensByOwner = new Map<string, DemoRmActorToken>();
  for (const ownerId of frozenOwnerIds) {
    const token = Object.freeze(Object.create(null)) as DemoRmActorToken;
    tokens.add(token);
    ownerByToken.set(token, ownerId);
    tokensByOwner.set(ownerId, token);
  }

  function isToken(value: unknown): value is DemoRmActorToken {
    return value !== null && typeof value === "object" && tokens.has(value);
  }

  function validateState(value: unknown): DemoRmState | null {
    const state = closedDataRecord(value, ["version", "namespace", "kind", "rms"]);
    if (!state || state.version !== VERSION || state.namespace !== namespace || state.kind !== kind) return null;
    const rows = closedArray(state.rms);
    if (!rows) return null;
    const ids = new Set<string>();
    const rms: DemoRmLedgerRow[] = [];
    for (const value of rows) {
      const row = readRow(value, ownerIds);
      if (!row || ids.has(row.id)) return null;
      ids.add(row.id);
      rms.push(row);
    }
    return { version: VERSION, namespace, kind, rms };
  }

  function rejected(state: unknown, error = NOT_AUTHORIZED): Transition {
    return { state, result: { success: false, error } };
  }

  function getActorToken(ownerId: unknown): DemoRmActorToken | null {
    return typeof ownerId === "string" ? tokensByOwner.get(ownerId) ?? null : null;
  }

  function emptyState(): DemoRmState {
    return { version: VERSION, namespace, kind, rms: [] };
  }

  function resetState(fixture?: unknown): DemoRmState | null {
    if (fixture === undefined) return emptyState();
    const valid = validateState(fixture);
    return valid ? { ...valid, rms: valid.rms.map((row) => ({ ...row })) } : null;
  }

  function createRm(state: unknown, actor: unknown, command: unknown): Transition {
    if (!isToken(actor)) return rejected(state);
    const validState = validateState(state);
    if (!validState) return rejected(state, INVALID_STATE);
    const parsedCommand = readCommand(command);
    if (!parsedCommand || !isValidId(parsedCommand.id) || validState.rms.some((row) => row.id === parsedCommand.id)) return rejected(state, NOT_AUTHORIZED);
    const fields = parseFields(parsedCommand);
    if ("error" in fields) return rejected(state, fields.error);
    const studentId = ownerByToken.get(actor);
    if (!studentId) return rejected(state);
    const row: DemoRmLedgerRow = { ...fields.value, studentId };
    return { state: { ...validState, rms: [...validState.rms, row] }, result: { success: true, id: row.id } };
  }

  function updateRm(state: unknown, actor: unknown, command: unknown): Transition {
    if (!isToken(actor)) return rejected(state);
    const validState = validateState(state);
    if (!validState) return rejected(state, INVALID_STATE);
    const parsedCommand = readCommand(command);
    if (!parsedCommand || !isValidId(parsedCommand.id)) return rejected(state, NOT_AUTHORIZED);
    const existing = validState.rms.find((row) => row.id === parsedCommand.id);
    const studentId = ownerByToken.get(actor);
    if (!existing || existing.studentId !== studentId) return rejected(state, rmNotFound());
    // Keep production ordering: ownership is decided before exercise/weight/date semantics.
    const fields = parseFields(parsedCommand);
    if ("error" in fields) return rejected(state, fields.error);
    return {
      state: { ...validState, rms: validState.rms.map((row) => row.id === existing.id ? { ...row, ...fields.value, studentId: row.studentId } : { ...row }) },
      result: { success: true },
    };
  }

  function deleteRm(state: unknown, actor: unknown, id: unknown): Transition {
    if (!isToken(actor)) return rejected(state);
    const validState = validateState(state);
    if (!validState) return rejected(state, INVALID_STATE);
    if (typeof id !== "string" || !isValidId(id)) return rejected(state, NOT_AUTHORIZED);
    const existing = validState.rms.find((row) => row.id === id);
    const studentId = ownerByToken.get(actor);
    if (!existing || existing.studentId !== studentId) return rejected(state, rmNotFound());
    return { state: { ...validState, rms: validState.rms.filter((row) => row.id !== id).map((row) => ({ ...row })) }, result: { success: true } };
  }

  function projectRms(state: unknown, actor: unknown): DemoRmProjectionResult {
    if (!isToken(actor)) return { success: false, error: NOT_AUTHORIZED };
    const validState = validateState(state);
    if (!validState) return { success: false, error: INVALID_STATE };
    const studentId = ownerByToken.get(actor);
    if (!studentId) return { success: false, error: NOT_AUTHORIZED };
    const rms = validState.rms
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.studentId === studentId)
      .sort((a, b) => b.row.date.localeCompare(a.row.date) || a.index - b.index)
      .map(({ row }) => {
        const date = new Date(row.date + "T00:00:00.000Z");
        // RmsView accepts Date values for both fields. createdAt is deliberately derived,
        // not persisted or clock-generated, because this core's ledger has no timestamp field.
        return { id: row.id, exercise: row.exercise, weight: row.weight, date, createdAt: new Date(date.getTime()) };
      });
    return { success: true, rms };
  }

  return Object.freeze({
    kind,
    namespace,
    getActorToken,
    emptyState,
    resetState,
    isValidState: (state: unknown) => validateState(state) !== null,
    createRm,
    updateRm,
    deleteRm,
    projectRms,
  });
}
