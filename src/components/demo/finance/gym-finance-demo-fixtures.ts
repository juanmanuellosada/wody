// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ARCHIVED_STUDENT_ID, GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, GYM_DEMO_MUSLIB_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID, GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, getGymDemoProfile, getGymDemoTeacherStudentLinks } from "../scenarios/gym-demo-directory.ts";
import type { FinanceCategory, FinanceProduct, FinanceStudent, GymFinanceDemoState } from "./finance-demo-types";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { GYM_FINANCE_DEMO_DEFAULT_ANCHOR, GYM_FINANCE_DEMO_NAMESPACE, GYM_FINANCE_DEMO_VERSION } from "./finance-demo-types.ts";

function addDays(anchor: string, days: number): string {
  const value = new Date(`${anchor}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function student(id: string, anchor: string, days: number, options: { blocked?: boolean; exempt?: string; deleted?: boolean } = {}): FinanceStudent {
  const profile = getGymDemoProfile(id);
  if (!profile || profile.role !== "STUDENT") throw new Error("Missing canonical GYM finance student.");
  const assignedTeachers = getGymDemoTeacherStudentLinks()
    .filter((link) => link.studentId === id)
    .map((link) => getGymDemoProfile(link.teacherId))
    .filter((teacher): teacher is NonNullable<typeof teacher> => Boolean(teacher))
    .map((teacher) => ({ id: teacher.id, name: teacher.name }));
  return {
    id: profile.id,
    name: profile.name,
    email: profile.accountKind === "LITE" ? null : `${profile.id}@finance-demo.invalid`,
    nextPaymentDate: addDays(anchor, days),
    studentType: profile.studentType!,
    accountKind: profile.accountKind,
    canCreateOwnRoutines: profile.canCreateOwnRoutines,
    paymentExempt: Boolean(options.exempt),
    paymentExemptReason: options.exempt ?? null,
    assignedTeachers,
    blocked: Boolean(options.blocked),
    deletedAt: options.deleted ? profile.deletedAt : null,
  };
}

/** Independent GYM finance people; display/relationship facts are copied from the canonical directory. */
export function getGymFinancePeople(anchor: string = GYM_FINANCE_DEMO_DEFAULT_ANCHOR): FinanceStudent[] {
  return [
    student(GYM_DEMO_GENERAL_STUDENT_ID, anchor, -12),
    student(GYM_DEMO_PERSONALIZED_STUDENT_ID, anchor, 3, { blocked: true }),
    student(GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, anchor, 15),
    student(GYM_DEMO_MUSLIB_STUDENT_ID, anchor, -30, { exempt: "Beca de demostración" }),
    student(GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, anchor, 0),
    student(GYM_DEMO_ARCHIVED_STUDENT_ID, anchor, -45, { deleted: true }),
  ];
}

const categories: readonly FinanceCategory[] = Object.freeze([
  Object.freeze({ id: "gym-finance-category-accessories", name: "Accesorios" }),
  Object.freeze({ id: "gym-finance-category-supplements", name: "Suplementos" }),
]);

const products: readonly FinanceProduct[] = Object.freeze([
  Object.freeze({ id: "gym-finance-product-band", code: 1, description: "Banda elástica", categoryId: "gym-finance-category-accessories", priceCents: 2_500, stock: 10, deletedAt: null }),
  Object.freeze({ id: "gym-finance-product-bottle", code: 2, description: "Botella deportiva", categoryId: "gym-finance-category-accessories", priceCents: 4_000, stock: 8, deletedAt: null }),
  Object.freeze({ id: "gym-finance-product-protein", code: 3, description: "Proteína 1kg", categoryId: "gym-finance-category-supplements", priceCents: 32_000, stock: 5, deletedAt: null }),
]);

export function getGymFinanceCatalogFixtures(): { categories: FinanceCategory[]; products: FinanceProduct[]; nextProductCode: number } {
  return { categories: categories.map((category) => ({ ...category })), products: products.map((product) => ({ ...product })), nextProductCode: 4 };
}

export function createGymFinanceDemoFixture(anchor: string = GYM_FINANCE_DEMO_DEFAULT_ANCHOR): GymFinanceDemoState {
  const catalog = getGymFinanceCatalogFixtures();
  return {
    version: GYM_FINANCE_DEMO_VERSION,
    namespace: GYM_FINANCE_DEMO_NAMESPACE,
    anchor,
    students: getGymFinancePeople(anchor).map((value) => ({ ...value, assignedTeachers: value.assignedTeachers.map((teacher) => ({ ...teacher })) })),
    payments: [],
    categories: catalog.categories,
    products: catalog.products,
    sales: [],
    expenses: [],
    nextProductCode: catalog.nextProductCode,
  };
}
