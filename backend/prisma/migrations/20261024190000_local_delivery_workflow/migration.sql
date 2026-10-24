ALTER TABLE "Delivery"
ADD COLUMN "recipientName" TEXT,
ADD COLUMN "recipientPhone" TEXT,
ADD COLUMN "packageDescription" TEXT,
ADD COLUMN "distanceKm" DECIMAL(8,2) NOT NULL DEFAULT 1;

CREATE TABLE "DeliveryEvent" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL,
  "note" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DeliveryEvent_deliveryId_createdAt_idx" ON "DeliveryEvent"("deliveryId", "createdAt");

INSERT INTO "DeliveryEvent" ("id", "deliveryId", "status", "note", "createdAt")
SELECT gen_random_uuid()::text, "id", "status", 'Estado registrado na atualização do sistema.', "updatedAt" FROM "Delivery";

CREATE UNIQUE INDEX "CourierShift_one_open_shift" ON "CourierShift"("courierId") WHERE "closedAt" IS NULL;
CREATE UNIQUE INDEX "Delivery_one_active_per_courier" ON "Delivery"("courierId") WHERE "courierId" IS NOT NULL AND "status" IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT');
