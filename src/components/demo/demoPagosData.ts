import type { DemoPaymentRow } from "./DemoPagosView";
import { getTodayArgentina } from "@/lib/dates";

const CARLOS = { id: "t1", name: "Carlos Entrenador" };
const ANA = { id: "t2", name: "Ana Coach" };

export const demoTeachers = [CARLOS, ANA];

function dateOffset(days: number): Date {
  const d = getTodayArgentina();
  d.setDate(d.getDate() + days);
  return d;
}

export function getDemoPagosRows(): DemoPaymentRow[] {
  return [
    {
      id: "s1",
      name: "Juan Pérez",
      email: "juan@demo.com",
      nextPaymentDate: dateOffset(-12),
      assignedTeachers: [CARLOS],
    },
    {
      id: "s2",
      name: "María García",
      email: "maria@demo.com",
      nextPaymentDate: dateOffset(-3),
      assignedTeachers: [CARLOS],
    },
    {
      id: "s3",
      name: "Lucas Rodríguez",
      email: "lucas@demo.com",
      nextPaymentDate: dateOffset(2),
      assignedTeachers: [CARLOS],
    },
    {
      id: "s4",
      name: "Sofía López",
      email: "sofia@demo.com",
      nextPaymentDate: dateOffset(5),
      assignedTeachers: [ANA],
    },
    {
      id: "s5",
      name: "Tomás Fernández",
      email: "tomas@demo.com",
      nextPaymentDate: dateOffset(14),
      assignedTeachers: [ANA],
    },
    {
      id: "s6",
      name: "Camila Suárez",
      email: "camila@demo.com",
      nextPaymentDate: dateOffset(22),
      assignedTeachers: [CARLOS],
    },
  ];
}
