import { getTodayArgentina } from "@/lib/dates";

export type AccessState = "GRANTED" | "DENIED" | "PENDING";

export type DemoAccessRow = {
  id: string;
  date: Date;
  userName: string;
  memberNumber: number;
  state: AccessState;
  decidedBy: string | null;
};

function dateTimeOffset(days: number, hours: number, minutes: number): Date {
  const d = getTodayArgentina();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function getDemoIngresosRows(): DemoAccessRow[] {
  return [
    {
      id: "al1",
      date: dateTimeOffset(0, 9, 5),
      userName: "Juan Pérez",
      memberNumber: 1,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al2",
      date: dateTimeOffset(0, 9, 12),
      userName: "María García",
      memberNumber: 2,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al3",
      date: dateTimeOffset(0, 9, 30),
      userName: "Lucas Rodríguez",
      memberNumber: 3,
      state: "DENIED",
      decidedBy: "Carlos Entrenador",
    },
    {
      id: "al4",
      date: dateTimeOffset(0, 10, 2),
      userName: "Sofía López",
      memberNumber: 4,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al5",
      date: dateTimeOffset(0, 10, 45),
      userName: "Tomás Fernández",
      memberNumber: 5,
      state: "PENDING",
      decidedBy: null,
    },
    {
      id: "al6",
      date: dateTimeOffset(-1, 8, 55),
      userName: "Camila Suárez",
      memberNumber: 6,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al7",
      date: dateTimeOffset(-1, 9, 20),
      userName: "Juan Pérez",
      memberNumber: 1,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al8",
      date: dateTimeOffset(-1, 10, 10),
      userName: "María García",
      memberNumber: 2,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al9",
      date: dateTimeOffset(-1, 11, 0),
      userName: "Lucas Rodríguez",
      memberNumber: 3,
      state: "PENDING",
      decidedBy: null,
    },
    {
      id: "al10",
      date: dateTimeOffset(-2, 9, 5),
      userName: "Sofía López",
      memberNumber: 4,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al11",
      date: dateTimeOffset(-2, 9, 40),
      userName: "Tomás Fernández",
      memberNumber: 5,
      state: "DENIED",
      decidedBy: "Ana Coach",
    },
    {
      id: "al12",
      date: dateTimeOffset(-2, 10, 15),
      userName: "Camila Suárez",
      memberNumber: 6,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al13",
      date: dateTimeOffset(-3, 8, 50),
      userName: "Juan Pérez",
      memberNumber: 1,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al14",
      date: dateTimeOffset(-3, 9, 33),
      userName: "María García",
      memberNumber: 2,
      state: "GRANTED",
      decidedBy: null,
    },
    {
      id: "al15",
      date: dateTimeOffset(-3, 10, 55),
      userName: "Lucas Rodríguez",
      memberNumber: 3,
      state: "DENIED",
      decidedBy: "Carlos Entrenador",
    },
  ];
}
