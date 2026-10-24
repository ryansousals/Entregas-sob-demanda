-- CreateTable
CREATE TABLE "CourierShift" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CourierShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourierShift_courierId_closedAt_idx" ON "CourierShift"("courierId", "closedAt");

-- CreateIndex
CREATE INDEX "Delivery_customerId_idx" ON "Delivery"("customerId");

-- CreateIndex
CREATE INDEX "Delivery_courierId_status_idx" ON "Delivery"("courierId", "status");

-- AddForeignKey
ALTER TABLE "CourierShift" ADD CONSTRAINT "CourierShift_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "CourierProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierShift" ADD CONSTRAINT "CourierShift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierShift" ADD CONSTRAINT "CourierShift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
