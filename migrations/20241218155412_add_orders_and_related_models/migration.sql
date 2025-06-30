-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ReductionType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHONE', 'ADDRESS', 'EMAIL');

-- CreateEnum
CREATE TYPE "OrderLineDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED');

-- CreateTable
CREATE TABLE "products" (
    "uuid" TEXT NOT NULL,
    "available_stock" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "miniature_hash" TEXT,
    "cip7" TEXT,
    "cip13" TEXT,
    "ean13" TEXT NOT NULL,
    "price_without_tax" INTEGER NOT NULL,
    "percent_tax_rate" INTEGER NOT NULL,
    "locations" JSONB,
    "laboratory_uuid" TEXT,
    "description" TEXT,
    "instructions_for_use" TEXT,
    "composition" TEXT,
    "weight" INTEGER NOT NULL,
    "max_quantity_for_order" INTEGER,
    "status" "ProductStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "product_promotions" (
    "product_uuid" TEXT NOT NULL,
    "promotion_uuid" TEXT NOT NULL,

    CONSTRAINT "product_promotions_pkey" PRIMARY KEY ("product_uuid","promotion_uuid")
);

-- CreateTable
CREATE TABLE "promotions" (
    "uuid" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "ReductionType" NOT NULL,
    "name" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "uuid" TEXT NOT NULL,
    "product_uuid" TEXT NOT NULL,
    "order_uuid" TEXT NOT NULL,
    "price_without_tax" INTEGER NOT NULL,
    "percent_tax_rate" INTEGER NOT NULL,
    "expected_quantity" INTEGER NOT NULL,
    "prepared_quantity" INTEGER NOT NULL,
    "promotion_uuid" TEXT,
    "delivery_status" "OrderLineDeliveryStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "images" (
    "hash" TEXT NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "images_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "product_images" (
    "product_uuid" TEXT NOT NULL,
    "image_hash" TEXT NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_uuid","image_hash")
);

-- CreateTable
CREATE TABLE "categories" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "product_uuid" TEXT NOT NULL,
    "category_uuid" TEXT NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_uuid","category_uuid")
);

-- CreateTable
CREATE TABLE "laboratories" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "orders" (
    "uuid" TEXT NOT NULL,
    "delivery_address_uuid" TEXT NOT NULL,
    "billing_address_uuid" TEXT NOT NULL,
    "phone_uuid" TEXT NOT NULL,
    "email_uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "medias" (
    "uuid" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "type" "MediaType" NOT NULL,
    "name" TEXT,

    CONSTRAINT "medias_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "uuid" TEXT NOT NULL,
    "receiver_address_uuid" TEXT NOT NULL,
    "receiver_email_uuid" TEXT NOT NULL,
    "receiver_phone_uuid" TEXT NOT NULL,
    "sender_address_uuid" TEXT NOT NULL,
    "sender_email_uuid" TEXT NOT NULL,
    "sender_phone_uuid" TEXT NOT NULL,
    "order_uuid" TEXT NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "messages" (
    "uuid" TEXT NOT NULL,
    "orderUuid" TEXT NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "payments" (
    "uuid" TEXT NOT NULL,
    "orderUuid" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_uuid_key" ON "products"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "products_miniature_hash_key" ON "products"("miniature_hash");

-- CreateIndex
CREATE UNIQUE INDEX "products_cip7_key" ON "products"("cip7");

-- CreateIndex
CREATE UNIQUE INDEX "products_cip13_key" ON "products"("cip13");

-- CreateIndex
CREATE UNIQUE INDEX "products_ean13_key" ON "products"("ean13");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_uuid_key" ON "promotions"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_uuid_key" ON "order_lines"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "images_hash_key" ON "images"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "categories_uuid_key" ON "categories"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_uuid_key" ON "laboratories"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "orders_uuid_key" ON "orders"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "medias_uuid_key" ON "medias"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_uuid_key" ON "deliveries"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "messages_uuid_key" ON "messages"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "payments_uuid_key" ON "payments"("uuid");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_miniature_hash_fkey" FOREIGN KEY ("miniature_hash") REFERENCES "images"("hash") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_laboratory_uuid_fkey" FOREIGN KEY ("laboratory_uuid") REFERENCES "laboratories"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_promotions" ADD CONSTRAINT "product_promotions_product_uuid_fkey" FOREIGN KEY ("product_uuid") REFERENCES "products"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_promotions" ADD CONSTRAINT "product_promotions_promotion_uuid_fkey" FOREIGN KEY ("promotion_uuid") REFERENCES "promotions"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_uuid_fkey" FOREIGN KEY ("product_uuid") REFERENCES "products"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_promotion_uuid_fkey" FOREIGN KEY ("promotion_uuid") REFERENCES "promotions"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_uuid_fkey" FOREIGN KEY ("order_uuid") REFERENCES "orders"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_uuid_fkey" FOREIGN KEY ("product_uuid") REFERENCES "products"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_image_hash_fkey" FOREIGN KEY ("image_hash") REFERENCES "images"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_uuid_fkey" FOREIGN KEY ("product_uuid") REFERENCES "products"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_uuid_fkey" FOREIGN KEY ("category_uuid") REFERENCES "categories"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_uuid_fkey" FOREIGN KEY ("delivery_address_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_uuid_fkey" FOREIGN KEY ("billing_address_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_phone_uuid_fkey" FOREIGN KEY ("phone_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_email_uuid_fkey" FOREIGN KEY ("email_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_receiver_address_uuid_fkey" FOREIGN KEY ("receiver_address_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_receiver_email_uuid_fkey" FOREIGN KEY ("receiver_email_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_receiver_phone_uuid_fkey" FOREIGN KEY ("receiver_phone_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sender_address_uuid_fkey" FOREIGN KEY ("sender_address_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sender_email_uuid_fkey" FOREIGN KEY ("sender_email_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sender_phone_uuid_fkey" FOREIGN KEY ("sender_phone_uuid") REFERENCES "medias"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_uuid_fkey" FOREIGN KEY ("order_uuid") REFERENCES "orders"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_orderUuid_fkey" FOREIGN KEY ("orderUuid") REFERENCES "orders"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderUuid_fkey" FOREIGN KEY ("orderUuid") REFERENCES "orders"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
