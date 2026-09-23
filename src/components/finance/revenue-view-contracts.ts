export type RevenuePaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";
export type RevenueStudentType = "GENERAL" | "PERSONALIZED" | "MUSCULACION_LIBRE" | "";
export type RevenueGymKind = "GYM" | "BOX" | "PERSONAL" | null | undefined;
export type RevenueView = "alumnos" | "productos" | "mixta";

export interface RevenueTeacher {
  id: string;
  name: string;
}

export interface RevenueCategory {
  id: string;
  name: string;
}

export interface RevenueActiveFilters {
  from: string;
  to: string;
  teacherIds: string[];
  methodIds: RevenuePaymentMethod[];
  studentType: RevenueStudentType;
  categoryId: string;
}

export interface RevenuePeriodMetric {
  total: number;
  count: number;
}

export interface RevenueStats {
  current: RevenuePeriodMetric;
  previous: RevenuePeriodMetric;
  totalChange: number | null;
  countChange: number | null;
}

export interface RevenueIncomeStats {
  current: RevenuePeriodMetric;
  previous: RevenuePeriodMetric;
  totalChange: number | null;
}

export interface RevenueNetStats {
  cuotas: RevenueStats;
  ventas: RevenueStats;
  gastos: RevenueStats;
  ingresos: RevenueIncomeStats;
  resultado: { current: number; previous: number; change: number | null };
}

export interface RevenueMonthlyPoint {
  month: string;
  total: number;
  count: number;
}

export interface RevenueNetMonthlyPoint {
  month: string;
  ingresos: number;
  gastos: number;
  resultado: number;
}

export interface PaymentFiltersViewProps {
  teachers: RevenueTeacher[];
  isAdmin: boolean;
  gymKind: RevenueGymKind;
  current: Pick<RevenueActiveFilters, "from" | "to" | "teacherIds" | "methodIds" | "studentType">;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onTeacherToggle: (teacherId: string) => void;
  onClearTeachers: () => void;
  onMethodToggle: (method: RevenuePaymentMethod) => void;
  onClearMethods: () => void;
  onStudentTypeChange: (studentType: RevenueStudentType) => void;
}

export interface RevenueFiltersViewProps {
  current: Pick<RevenueActiveFilters, "from" | "to" | "methodIds" | "categoryId">;
  categories?: RevenueCategory[];
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onMethodToggle: (method: RevenuePaymentMethod) => void;
  onCategoryChange: (categoryId: string) => void;
}
