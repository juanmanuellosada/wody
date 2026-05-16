-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentMethod" "PaymentMethod";
