import type { FeeIdentity, FeeStudent, FeeTeacher } from "./fees-contract";

const CARLOS: FeeTeacher = { id: "finance-teacher-carlos", name: "Carlos Entrenador" };
const ANA: FeeTeacher = { id: "finance-teacher-ana", name: "Ana Coach" };

export const demoFeeTeachers = [CARLOS, ANA];

export const demoFeeIdentities: Record<"admin" | "teacher", FeeIdentity> = {
  admin: { id: "finance-admin", role: "ADMIN", name: "Administración demo" },
  teacher: { id: CARLOS.id, role: "TEACHER", name: CARLOS.name },
};

function addDays(anchor: string, days: number): string {
  const value = new Date(`${anchor}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Deterministic date-only fixtures. The adapter provides today's Argentina date
 * after hydration, avoiding build-time dates in static exports.
 */
export function getDemoFeeFixtures(anchor: string): FeeStudent[] {
  return [
    {
      id: "fee-student-juan",
      name: "Juan Pérez",
      email: "juan@demo.com",
      nextPaymentDate: addDays(anchor, -12),
      studentType: "GENERAL",
      accountKind: "FULL",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [CARLOS],
      blocked: false,
    },
    {
      id: "fee-student-maria",
      name: "María García",
      email: "maria@demo.com",
      nextPaymentDate: addDays(anchor, -3),
      studentType: "PERSONALIZED",
      accountKind: "FULL",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [CARLOS],
      blocked: true,
    },
    {
      id: "fee-student-lucas",
      name: "Lucas Rodríguez",
      email: "lucas@demo.com",
      nextPaymentDate: addDays(anchor, 2),
      studentType: "GENERAL",
      accountKind: "FULL",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [CARLOS, ANA],
      blocked: false,
    },
    {
      id: "fee-student-sofia",
      name: "Sofía López",
      email: "sofia@demo.com",
      nextPaymentDate: addDays(anchor, 5),
      studentType: "PERSONALIZED",
      accountKind: "FULL",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [ANA],
      blocked: false,
    },
    {
      id: "fee-student-tomas",
      name: "Tomás Fernández",
      email: "tomas@demo.com",
      nextPaymentDate: addDays(anchor, 14),
      studentType: "GENERAL",
      accountKind: "FULL",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [],
      blocked: false,
    },
    {
      id: "fee-student-camila",
      name: "Camila Suárez",
      email: null,
      nextPaymentDate: addDays(anchor, 22),
      studentType: "GENERAL",
      accountKind: "LITE",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [CARLOS],
      blocked: false,
    },
    {
      id: "fee-student-valentina",
      name: "Valentina Ruiz",
      email: "valentina@demo.com",
      nextPaymentDate: addDays(anchor, -20),
      studentType: "PERSONALIZED",
      accountKind: "FULL",
      paymentExempt: true,
      paymentExemptReason: "Beca de demostración",
      assignedTeachers: [CARLOS],
      blocked: false,
    },
    {
      id: "fee-student-archived",
      name: "Alumno archivado",
      email: "archivado@demo.com",
      nextPaymentDate: addDays(anchor, -1),
      studentType: "GENERAL",
      accountKind: "FULL",
      paymentExempt: false,
      paymentExemptReason: null,
      assignedTeachers: [CARLOS],
      blocked: false,
      deletedAt: addDays(anchor, -1),
    },
  ];
}
