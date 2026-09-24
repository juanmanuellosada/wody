// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { demoFeeIdentities, getDemoFeeFixtures } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isValidFinanceExpenseGraph } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createFinanceDemoFixture, isFinanceDate } from "./finance-demo-state.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { getGymFinancePeople } from "./gym-finance-demo-fixtures.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ADMIN_ID, getGymDemoProfile, getGymDemoTeacherStudentLinks } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { snapshotDemoStorageValue } from "../training/demo-storage-snapshot.ts";
import {
  FINANCE_DEMO_LEGACY_STORAGE_KEY,
  FINANCE_DEMO_NAMESPACE,
  FINANCE_DEMO_STORAGE_KEY,
  FINANCE_DEMO_V2_STORAGE_KEY,
  FINANCE_DEMO_VERSION,
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
} from "./finance-demo-types.ts";
import type { FinanceDemoLegacyState, FinanceDemoState, FinanceDemoV2State, FinancePaymentMethod, GymFinanceDemoState, KnownFinanceDemoState } from "./finance-demo-types";

const LEGACY_VERSION = 1;
const V2_VERSION = 2;
const PAYMENT_METHODS: readonly FinancePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];
const MAX_PAYMENT_CENTS = 999_999_999_999;
const MAX_CATALOG_CENTS = 999_999_999_999;
const POSTGRES_INT_MIN = -2_147_483_648;
const POSTGRES_INT_MAX = 2_147_483_647;

export type FinanceDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type FinanceStorageLoad = { state: FinanceDemoState; warning: string | null };

type ParsedState = { state: FinanceDemoState; sourceVersion: 1 | 2 | 3 } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Persisted JSON is closed: invented capability or accounting fields invalidate the whole graph. */
function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPaymentMethod(value: unknown): value is FinancePaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as FinancePaymentMethod);
}

/** Array.prototype.every skips holes, so verify density before every traversal. */
function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) return false;
  }
  return true;
}

function sameArray(left: unknown, right: unknown): boolean {
  return isDenseArray(left)
    && isDenseArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function isPostgresInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= POSTGRES_INT_MIN && value <= POSTGRES_INT_MAX;
}

function isPositivePostgresInt(value: unknown): value is number {
  return isPostgresInt(value) && value >= 1;
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_CATALOG_CENTS;
}

/** State keeps fixture metadata closed: only an active student's next due date is mutable. */
function hasFixtureStudentMetadata(state: Record<string, unknown>): boolean {
  if (!isFinanceDate(state.anchor) || !isDenseArray(state.students)) return false;
  const studentKeys = ["id", "name", "email", "nextPaymentDate", "studentType", "accountKind", "canCreateOwnRoutines", "paymentExempt", "paymentExemptReason", "assignedTeachers", "blocked", "deletedAt"];
  const teacherKeys = ["id", "name"];
  const fixtures = getDemoFeeFixtures(state.anchor);
  if (state.students.length !== fixtures.length) return false;
  const seenIds = new Set<string>();
  return state.students.every((student) => {
    if (!isRecord(student)
      || !hasOnlyKeys(student, studentKeys)
      || !isId(student.id)
      || !isFinanceDate(student.nextPaymentDate)
      || !isDenseArray(student.assignedTeachers)
      || !student.assignedTeachers.every((teacher) => isRecord(teacher) && hasOnlyKeys(teacher, teacherKeys) && isId(teacher.id) && typeof teacher.name === "string")) return false;
    if (seenIds.has(student.id)) return false;
    seenIds.add(student.id);
    const fixture = fixtures.find((candidate) => candidate.id === student.id);
    if (!fixture) return false;
    return student.name === fixture.name
      && student.email === fixture.email
      && student.studentType === fixture.studentType
      && student.accountKind === fixture.accountKind
      && student.canCreateOwnRoutines === fixture.canCreateOwnRoutines
      && student.paymentExempt === fixture.paymentExempt
      && student.paymentExemptReason === fixture.paymentExemptReason
      && student.blocked === fixture.blocked
      && student.deletedAt === fixture.deletedAt
      && sameArray(
        student.assignedTeachers.map((teacher) => isRecord(teacher) ? `${teacher.id}:${teacher.name}` : null),
        fixture.assignedTeachers.map((teacher) => `${teacher.id}:${teacher.name}`),
      );
  });
}

function knownPaymentRecorder(id: string): boolean {
  return Object.values(demoFeeIdentities).some((identity) => identity.id === id);
}

function validBaseFinanceGraph(value: unknown, version: number): value is Record<string, unknown> {
  if (!isRecord(value)
    || value.version !== version
    || value.namespace !== FINANCE_DEMO_NAMESPACE
    || !hasFixtureStudentMetadata(value)
    || !isDenseArray(value.payments)
    || !isDenseArray(value.students)) return false;
  const students = value.students as Record<string, unknown>[];
  const studentById = new Map(students.map((student) => [student.id as string, student]));
  const paymentIds = new Set<string>();
  const commandIds = new Set<string>();
  const paymentKeys = ["id", "studentId", "amountCents", "paidAt", "nextPaymentDate", "paymentMethod", "recordedById", "commandId"];
  return value.payments.every((payment) => {
    if (!isRecord(payment)
      || !hasOnlyKeys(payment, paymentKeys)
      || !isId(payment.id)
      || !isId(payment.commandId)
      || !isId(payment.studentId)
      || typeof payment.amountCents !== "number"
      || !Number.isSafeInteger(payment.amountCents)
      || payment.amountCents < 1
      || payment.amountCents > MAX_PAYMENT_CENTS
      || !isFinanceDate(payment.paidAt)
      || !isFinanceDate(payment.nextPaymentDate)
      || !isPaymentMethod(payment.paymentMethod)
      || !isId(payment.recordedById)) return false;
    if (paymentIds.has(payment.id) || commandIds.has(payment.commandId)) return false;
    paymentIds.add(payment.id);
    commandIds.add(payment.commandId);
    const student = studentById.get(payment.studentId);
    if (!student || student.deletedAt) return false;
    if (!knownPaymentRecorder(payment.recordedById)) return false;
    const recorder = Object.values(demoFeeIdentities).find((identity) => identity.id === payment.recordedById);
    return recorder?.role === "ADMIN" || (isDenseArray(student.assignedTeachers) && student.assignedTeachers.some((teacher) => isRecord(teacher) && teacher.id === recorder?.id));
  });
}

/** Version 1 is deliberately validated independently before migration. */
export function isValidFinanceDemoLegacyState(value: unknown): value is FinanceDemoLegacyState {
  return validBaseFinanceGraph(value, LEGACY_VERSION)
    && hasOnlyKeys(value, ["version", "namespace", "anchor", "students", "payments"])
    && !("categories" in value)
    && !("products" in value)
    && !("sales" in value)
    && !("nextProductCode" in value)
    && !("expenses" in value);
}

function isKnownSaleRecorder(id: unknown): boolean {
  return typeof id === "string" && Object.values(financeCatalogSaleActors).some((actor) => actor.id === id);
}

/** Reject a malformed catalog/sale relation rather than partially salvaging it. */
function isValidCatalogSaleGraph(value: unknown, version: number): boolean {
  if (!validBaseFinanceGraph(value, version)
    || !isDenseArray(value.categories)
    || !isDenseArray(value.products)
    || !isDenseArray(value.sales)
    || !isPositivePostgresInt(value.nextProductCode)) return false;
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  for (const category of value.categories) {
    if (!isRecord(category) || !hasOnlyKeys(category, ["id", "name"]) || !isId(category.id) || typeof category.name !== "string" || !category.name.trim()) return false;
    if (categoryIds.has(category.id) || categoryNames.has(category.name)) return false;
    categoryIds.add(category.id);
    categoryNames.add(category.name);
  }
  const productIds = new Set<string>();
  const activeCodes = new Set<number>();
  for (const product of value.products) {
    if (!isRecord(product)
      || !hasOnlyKeys(product, ["id", "code", "description", "categoryId", "priceCents", "stock", "deletedAt"])
      || !isId(product.id)
      || !isPositivePostgresInt(product.code)
      || typeof product.description !== "string"
      || !product.description.trim()
      || !isId(product.categoryId)
      || !categoryIds.has(product.categoryId)
      || !isCents(product.priceCents)
      || !isPostgresInt(product.stock)
      || (product.deletedAt !== null && !isFinanceDate(product.deletedAt))) return false;
    if (productIds.has(product.id)) return false;
    productIds.add(product.id);
    if (product.deletedAt === null) {
      if (activeCodes.has(product.code)) return false;
      activeCodes.add(product.code);
    }
  }
  const saleIds = new Set<string>();
  const commandIds = new Set<string>();
  for (const sale of value.sales) {
    if (!isRecord(sale)
      || !hasOnlyKeys(sale, ["id", "commandId", "productId", "quantity", "unitAmountCents", "totalAmountCents", "paymentMethod", "soldAt", "recordedById"])
      || !isId(sale.id)
      || !isId(sale.commandId)
      || !isId(sale.productId)
      || !productIds.has(sale.productId)
      || !isPositivePostgresInt(sale.quantity)
      || !isCents(sale.unitAmountCents)
      || !isCents(sale.totalAmountCents)
      || sale.totalAmountCents !== sale.quantity * sale.unitAmountCents
      || !isPaymentMethod(sale.paymentMethod)
      || !isFinanceDate(sale.soldAt)
      || !isKnownSaleRecorder(sale.recordedById)) return false;
    if (saleIds.has(sale.id) || commandIds.has(sale.commandId)) return false;
    saleIds.add(sale.id);
    commandIds.add(sale.commandId);
  }
  return true;
}

/** Version 2 remains closed and read-only so v3 can migrate it without accepting expense fields. */
export function isValidFinanceDemoV2State(value: unknown): value is FinanceDemoV2State {
  return isRecord(value)
    && isValidCatalogSaleGraph(value, V2_VERSION)
    && hasOnlyKeys(value, ["version", "namespace", "anchor", "students", "payments", "categories", "products", "sales", "nextProductCode"])
    && !("expenses" in value);
}

/** The current v3 graph adds only closed, designated-admin-recorded expenses to the former catalog graph. */
export function isValidFinanceDemoState(value: unknown): value is FinanceDemoState {
  return isRecord(value)
    && isValidCatalogSaleGraph(value, FINANCE_DEMO_VERSION)
    && hasOnlyKeys(value, ["version", "namespace", "anchor", "students", "payments", "categories", "products", "sales", "expenses", "nextProductCode"])
    && isValidFinanceExpenseGraph(value.expenses);
}

function isGymFinanceStudentType(value: unknown): value is "GENERAL" | "PERSONALIZED" | "MUSCULACION_LIBRE" {
  return value === "GENERAL" || value === "PERSONALIZED" || value === "MUSCULACION_LIBRE";
}

/** GYM v1 is isolated from BOX storage migrations but validates the same closed accounting graph. */
function isValidOwnedGymFinanceDemoState(value: unknown): value is GymFinanceDemoState {
  if (!isRecord(value)
    || value.version !== 1
    || value.namespace !== "wody-gym-finance-demo"
    || !isFinanceDate(value.anchor)
    || !hasOnlyKeys(value, ["version", "namespace", "anchor", "students", "payments", "categories", "products", "sales", "expenses", "nextProductCode"])
    || !isDenseArray(value.students)
    || !isDenseArray(value.payments)
    || !isDenseArray(value.categories)
    || !isDenseArray(value.products)
    || !isDenseArray(value.sales)
    || !isDenseArray(value.expenses)
    || !isPositivePostgresInt(value.nextProductCode)) return false;
  const fixtures = getGymFinancePeople(value.anchor);
  if (value.students.length !== fixtures.length) return false;
  const students = new Map<string, Record<string, unknown>>();
  for (const row of value.students) {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "name", "email", "nextPaymentDate", "studentType", "accountKind", "canCreateOwnRoutines", "paymentExempt", "paymentExemptReason", "assignedTeachers", "blocked", "deletedAt"])
      || !isId(row.id) || !isFinanceDate(row.nextPaymentDate) || !isDenseArray(row.assignedTeachers) || students.has(row.id)) return false;
    const fixture = fixtures.find((candidate) => candidate.id === row.id);
    // Canonical fields are never editable through the profile bridge: they still pin to the frozen fixture.
    if (!fixture || row.email !== fixture.email || row.accountKind !== fixture.accountKind || row.deletedAt !== fixture.deletedAt) return false;
    // The seven profile-bridge commands can change these; only their shape is validated, not their fixture value.
    if (typeof row.name !== "string" || !row.name.trim()) return false;
    if (!isGymFinanceStudentType(row.studentType)) return false;
    if (typeof row.canCreateOwnRoutines !== "boolean" || typeof row.paymentExempt !== "boolean" || typeof row.blocked !== "boolean") return false;
    // The core always trims a stored reason and collapses a blank one to null; a blank/untrimmed reason cannot come from the bridge.
    if (row.paymentExemptReason !== null
      && (typeof row.paymentExemptReason !== "string" || !row.paymentExemptReason.trim() || row.paymentExemptReason !== row.paymentExemptReason.trim())) return false;
    const assignedTeacherIds = new Set<string>();
    if (!row.assignedTeachers.every((teacher) => {
      if (!isRecord(teacher) || !hasOnlyKeys(teacher, ["id", "name"]) || !isId(teacher.id) || typeof teacher.name !== "string" || assignedTeacherIds.has(teacher.id)) return false;
      const canonicalTeacher = getGymDemoProfile(teacher.id);
      if (canonicalTeacher === null || (canonicalTeacher.role !== "TEACHER" && canonicalTeacher.role !== "ADMIN") || canonicalTeacher.deletedAt !== null || teacher.name !== canonicalTeacher.name) return false;
      assignedTeacherIds.add(teacher.id);
      return true;
    })) return false;
    students.set(row.id, row);
  }
  const categories = new Set<string>();
  const categoryNames = new Set<string>();
  for (const row of value.categories) {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "name"]) || !isId(row.id) || typeof row.name !== "string" || !row.name.trim() || categories.has(row.id) || categoryNames.has(row.name)) return false;
    categories.add(row.id); categoryNames.add(row.name);
  }
  const products = new Set<string>(); const activeCodes = new Set<number>();
  for (const row of value.products) {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "code", "description", "categoryId", "priceCents", "stock", "deletedAt"])
      || !isId(row.id) || !isPositivePostgresInt(row.code) || typeof row.description !== "string" || !row.description.trim()
      || !isId(row.categoryId) || !categories.has(row.categoryId) || !isCents(row.priceCents) || !isPostgresInt(row.stock)
      || (row.deletedAt !== null && !isFinanceDate(row.deletedAt)) || products.has(row.id)
      || (row.deletedAt === null && activeCodes.has(row.code))) return false;
    products.add(row.id); if (row.deletedAt === null) activeCodes.add(row.code);
  }
  const paymentIds = new Set<string>(); const commandIds = new Set<string>();
  for (const row of value.payments) {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "studentId", "amountCents", "paidAt", "nextPaymentDate", "paymentMethod", "recordedById", "commandId"])
      || !isId(row.id) || !isId(row.commandId) || !isId(row.studentId) || !students.has(row.studentId)
      || !isCents(row.amountCents) || row.amountCents < 1 || !isFinanceDate(row.paidAt) || !isFinanceDate(row.nextPaymentDate) || !isPaymentMethod(row.paymentMethod)
      || typeof row.recordedById !== "string" || paymentIds.has(row.id) || commandIds.has(row.commandId)) return false;
    const recorder = getGymDemoProfile(row.recordedById);
    if (!recorder || (recorder.role !== "ADMIN" && (recorder.role !== "TEACHER" || !getGymDemoTeacherStudentLinks().some((link) => link.teacherId === recorder.id && link.studentId === row.studentId)))) return false;
    paymentIds.add(row.id); commandIds.add(row.commandId);
  }
  const saleIds = new Set<string>(); commandIds.clear();
  for (const row of value.sales) {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "commandId", "productId", "quantity", "unitAmountCents", "totalAmountCents", "paymentMethod", "soldAt", "recordedById"])
      || !isId(row.id) || !isId(row.commandId) || !isId(row.productId) || !products.has(row.productId) || !isPositivePostgresInt(row.quantity)
      || !isCents(row.unitAmountCents) || !isCents(row.totalAmountCents) || row.totalAmountCents !== row.quantity * row.unitAmountCents
      || !isPaymentMethod(row.paymentMethod) || !isFinanceDate(row.soldAt) || typeof row.recordedById !== "string" || saleIds.has(row.id) || commandIds.has(row.commandId)) return false;
    const recorder = getGymDemoProfile(row.recordedById);
    if (!recorder || (recorder.role !== "ADMIN" && recorder.role !== "TEACHER")) return false;
    saleIds.add(row.id); commandIds.add(row.commandId);
  }
  const expenseIds = new Set<string>();
  for (const row of value.expenses) {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "amountCents", "description", "spentAt", "recordedById"])
      || !isId(row.id) || !isCents(row.amountCents) || row.amountCents < 1 || typeof row.description !== "string" || !row.description || row.description !== row.description.trim()
      || !isFinanceDate(row.spentAt) || row.recordedById !== GYM_DEMO_ADMIN_ID || expenseIds.has(row.id)) return false;
    expenseIds.add(row.id);
  }
  return true;
}

function gymRootHeaderGuard(keys: readonly (string | symbol)[], descriptors: PropertyDescriptorMap): boolean {
  if (!keys.includes("namespace") || !keys.includes("version")) return false;
  const namespace = descriptors.namespace;
  const version = descriptors.version;
  return Boolean(namespace && version && "value" in namespace && "value" in version
    && namespace.value === "wody-gym-finance-demo" && version.value === 1);
}

/** Captures a closed, owned GYM graph before validation so hostile input is never reread. */
export function getValidatedGymFinanceDemoState(value: unknown): GymFinanceDemoState | null {
  const captured = snapshotDemoStorageValue(value, new WeakSet<object>(), gymRootHeaderGuard);
  return captured.ok && isValidOwnedGymFinanceDemoState(captured.value) ? captured.value : null;
}

export function isValidGymFinanceDemoState(value: unknown): value is GymFinanceDemoState {
  return getValidatedGymFinanceDemoState(value) !== null;
}

export function isValidKnownFinanceDemoState(value: unknown): value is KnownFinanceDemoState {
  const captured = snapshotDemoStorageValue(value);
  if (captured.ok && isRecord(captured.value) && captured.value.namespace === "wody-gym-finance-demo") {
    return isValidOwnedGymFinanceDemoState(captured.value);
  }
  return isValidFinanceDemoState(value);
}

/** Converts only a complete, valid v2 graph; all existing graph order and values are retained exactly. */
export function migrateFinanceDemoStateV2(legacy: FinanceDemoV2State): FinanceDemoState {
  if (!isValidFinanceDemoV2State(legacy)) throw new Error("Cannot migrate an invalid finance demo v2 state.");
  return {
    version: FINANCE_DEMO_VERSION,
    namespace: legacy.namespace,
    anchor: legacy.anchor,
    students: legacy.students.map((student) => ({ ...student, assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })) })),
    payments: legacy.payments.map((payment) => ({ ...payment })),
    categories: legacy.categories.map((category) => ({ ...category })),
    products: legacy.products.map((product) => ({ ...product })),
    sales: legacy.sales.map((sale) => ({ ...sale })),
    expenses: [],
    nextProductCode: legacy.nextProductCode,
  };
}

/** Converts v1 via the established catalog fixture, then adds the empty v3 expense collection. */
export function migrateFinanceDemoStateV1(legacy: FinanceDemoLegacyState): FinanceDemoState {
  if (!isValidFinanceDemoLegacyState(legacy)) throw new Error("Cannot migrate an invalid finance demo v1 state.");
  const fixture = createFinanceDemoFixture(legacy.anchor);
  return {
    version: FINANCE_DEMO_VERSION,
    namespace: legacy.namespace,
    anchor: legacy.anchor,
    students: legacy.students.map((student) => ({ ...student, assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })) })),
    payments: legacy.payments.map((payment) => ({ ...payment })),
    categories: fixture.categories.map((category) => ({ ...category })),
    products: fixture.products.map((product) => ({ ...product })),
    sales: [],
    expenses: [],
    nextProductCode: fixture.nextProductCode,
  };
}

function parseState(raw: string | null | undefined): ParsedState {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidFinanceDemoState(parsed)) return { state: parsed, sourceVersion: 3 };
    if (isValidFinanceDemoV2State(parsed)) return { state: migrateFinanceDemoStateV2(parsed), sourceVersion: 2 };
    if (isValidFinanceDemoLegacyState(parsed)) return { state: migrateFinanceDemoStateV1(parsed), sourceVersion: 1 };
    return null;
  } catch {
    return null;
  }
}

function validatedFallback(fallback?: unknown): FinanceDemoState {
  if (isValidFinanceDemoState(fallback)) return fallback;
  if (isValidFinanceDemoV2State(fallback)) return migrateFinanceDemoStateV2(fallback);
  if (isValidFinanceDemoLegacyState(fallback)) return migrateFinanceDemoStateV1(fallback);
  return createFinanceDemoFixture();
}

export function serializeFinanceDemoState(state: FinanceDemoState): string {
  if (!isValidFinanceDemoState(state)) throw new Error("Cannot serialize an invalid finance demo state.");
  return JSON.stringify(state);
}

/** Direct raw resolution accepts strict v1, v2, or v3 graphs; persistence always serializes v3. */
export function resolveFinanceDemoInitialState(raw: string | null | undefined, fallback?: unknown): FinanceStorageLoad {
  const safeFallback = validatedFallback(fallback);
  if (!raw) return { state: safeFallback, warning: null };
  const parsed = parseState(raw);
  if (!parsed) return { state: safeFallback, warning: "El estado financiero guardado no es válido; se usó el estado de respaldo." };
  return {
    state: parsed.state,
    warning: parsed.sourceVersion === 3 ? null : "El estado financiero anterior se migró localmente.",
  };
}

function recoveryWarning(version: 1 | 2, latest: "missing" | "invalid" | "failed", middle?: "missing" | "invalid" | "failed"): string {
  const source = version === 2 ? "v2" : "v1";
  if (latest === "failed" || middle === "failed") return `No se pudo leer el estado financiero más reciente; se recuperó ${source}.`;
  if (latest === "invalid" || middle === "invalid") return `El estado financiero más reciente no es válido; se recuperó ${source}.`;
  return `El estado financiero ${source} se migró localmente.`;
}

/**
 * A valid v3 is authoritative and never probes legacy keys. Each unavailable,
 * missing, or malformed key is isolated before trying the next older version.
 * Loading is read-only; migration is persisted only by a later explicit commit.
 */
export function loadFinanceDemoState(storage: FinanceDemoStorage | null | undefined, fallback?: unknown): FinanceStorageLoad {
  const safeFallback = validatedFallback(fallback);
  if (!storage) return { state: safeFallback, warning: "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán." };

  let rawV3: string | null = null;
  let v3Status: "missing" | "invalid" | "failed" = "missing";
  try {
    rawV3 = storage.getItem(FINANCE_DEMO_STORAGE_KEY);
    const v3 = parseState(rawV3);
    if (v3?.sourceVersion === 3) return { state: v3.state, warning: null };
    v3Status = rawV3 === null ? "missing" : "invalid";
  } catch {
    v3Status = "failed";
  }

  let rawV2: string | null = null;
  let v2Status: "missing" | "invalid" | "failed" = "missing";
  try {
    rawV2 = storage.getItem(FINANCE_DEMO_V2_STORAGE_KEY);
    const v2 = parseState(rawV2);
    if (v2?.sourceVersion === 2) return { state: v2.state, warning: recoveryWarning(2, v3Status) };
    v2Status = rawV2 === null ? "missing" : "invalid";
  } catch {
    v2Status = "failed";
  }

  let rawV1: string | null = null;
  let v1Status: "missing" | "invalid" | "failed" = "missing";
  try {
    rawV1 = storage.getItem(FINANCE_DEMO_LEGACY_STORAGE_KEY);
    const v1 = parseState(rawV1);
    if (v1?.sourceVersion === 1) return { state: v1.state, warning: recoveryWarning(1, v3Status, v2Status) };
    v1Status = rawV1 === null ? "missing" : "invalid";
  } catch {
    v1Status = "failed";
  }

  if (v3Status === "failed" || v2Status === "failed" || v1Status === "failed") {
    return { state: safeFallback, warning: "No se pudo leer el almacenamiento de esta pestaña; se usó el estado de respaldo." };
  }
  return rawV3 === null && rawV2 === null && rawV1 === null
    ? { state: safeFallback, warning: null }
    : { state: safeFallback, warning: "El estado financiero guardado no es válido; se usó el estado de respaldo." };
}

/** Persistence writes only the current v3 namespace and never mutates v1/v2 keys. */
export function persistFinanceDemoState(storage: FinanceDemoStorage | null | undefined, state: FinanceDemoState): string | null {
  if (!storage) return "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.";
  try {
    storage.setItem(FINANCE_DEMO_STORAGE_KEY, serializeFinanceDemoState(state));
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
