import { DemoBeneficiosView } from "../../../../../../src/components/demo/DemoBeneficiosView";
import { demoBenefitsFixtures } from "../../../../../../src/components/demo/demo-benefits-fixtures";

export default function PreviewStudentBeneficiosPage() {
  return <DemoBeneficiosView coupons={demoBenefitsFixtures} />;
}
