// src/services/orderService.ts

import { PrismaClient } from "@prisma/client";
import winston from 'winston';
import { WinpharmaOrder, Address } from "../types/order"; // Assurez-vous que Address est bien importé
import { Decimal } from "@prisma/client/runtime/library";
import UuidToIntMapper from "../utils/uuidToIntMapper";

const prisma = new PrismaClient();

/**
 * Interface pour les clients
 */
export interface Customer {
  id_customer: number;
  uuid: string;
  birthday: string;
  lastname: string;
  firstname: string;
  email: string;
  phone: string;
  mobile: string;
}

/**
 * Type pour les commandes Prisma avec toutes les relations
 */
type PrismaOrder = {
  uuid: string;
  createdAt: Date;
  deliveryAddress: { data: any } | null;
  billingAddress: { data: any } | null;
  phone: { data: any } | null;
  email: { data: any } | null;
  deliveries: { price: Decimal | number }[];
  lines: Array<{
    expectedQuantity: number;
    priceWithoutTax: Decimal | number;
    percentTaxRate: Decimal | number;
    product: {
      ean13: string | null;
      name: string | null;
    };
    promotion: {
      amount: Decimal | number;
      type: string;
    } | null;
  }>;
};

/**
 * Fonction pour récupérer et mapper les commandes sans idPasserelle
 * @param uuidMapper Instance de UuidToIntMapper
 * @returns Tableau de WinpharmaOrder
 */
export const getOrdersToExport = async (uuidMapper: UuidToIntMapper): Promise<WinpharmaOrder[]> => {
  const logger = winston.createLogger({
    level: 'info',
    transports: [
      new winston.transports.Console(),
    ],
  });

  const orders = await prisma.order.findMany({
    where: {
      idPasserelle: null, // Filtrer les commandes sans idPasserelle
      payment: { // Utilisez 'payment' si la relation est singulière
        status: 'PAYED', // Sélectionner uniquement les paiements validés
      },
    },
    include: {
      deliveryAddress: true,
      billingAddress: true,
      phone: true,
      email: true,
      deliveries: true, // Inclure les livraisons pour récupérer le prix
      lines: {
        include: {
          product: true,
          promotion: true,
        },
      },
    },
  });

  const mappedOrders = mapPrismaOrdersToWinpharma(orders, uuidMapper);
  return mappedOrders;
};

/**
 * Fonction pour mapper les commandes Prisma vers le format Winpharma
 * @param orders Commandes Prisma
 * @param uuidMapper Instance de UuidToIntMapper
 * @returns Tableau de WinpharmaOrder
 */
const mapPrismaOrdersToWinpharma = (orders: PrismaOrder[], uuidMapper: UuidToIntMapper): WinpharmaOrder[] => {
  const logger = winston.createLogger({
    level: 'info',
    transports: [
      new winston.transports.Console(),
    ],
  });

  const mappedOrders = orders.map(order => {
    const billingData = order.billingAddress?.data as {
      zip: string;
      city: string;
      address: string;
      lastname: string;
      firstname: string;
      birthday?: string;
      mobile?: string;
    } || {};

    const deliveryData = order.deliveryAddress?.data as {
      zip: string;
      city: string;
      address: string;
      lastname: string;
      firstname: string;
    }|| {};

    const phoneData = order.phone?.data as { phone: string }|| {};
    const emailData = order.email?.data as { email: string }|| {};

    const birthday: string = billingData.birthday || "1970-01-01";
    const mobile: string = billingData.mobile || "0123456789";

    const customer: Customer = {
      id_customer: uuidMapper.getInt(order.uuid),
      uuid: order.uuid,
      birthday: birthday,
      lastname: billingData.lastname,
      firstname: billingData.firstname,
      email: emailData.email,
      phone: phoneData.phone,
      mobile: mobile,
    };

    const billingAddress: Address = {
      rue1: billingData.address,
      rue2: "",
      codepostal: billingData.zip,
      ville: billingData.city,
      pays: "FRANCE",
      tel: phoneData.phone,
      portable: customer.mobile,
      email: emailData.email,
    };

    const deliveryAddress: Address = {
      rue1: deliveryData.address,
      rue2: "",
      codepostal: deliveryData.zip,
      ville: deliveryData.city,
      pays: "FRANCE",
      tel: phoneData.phone,
      portable: customer.mobile,
      email: emailData.email,
    };

    logger.info(`Mapping order UUID: ${order.uuid}`);
    logger.info(`Customer Name: ${customer.firstname} ${customer.lastname}`);
    logger.info(`Customer Email: ${customer.email}`);
    logger.info(`Billing Address: ${billingAddress.rue1}, ${billingAddress.ville}`);
    logger.info(`Delivery Address: ${deliveryAddress.rue1}, ${deliveryAddress.ville}`);

    // Mapper les lignes de produits normales
    const productLines = order.lines.map(line => {
      const priceHT = line.priceWithoutTax instanceof Decimal 
        ? line.priceWithoutTax.toNumber()
        : line.priceWithoutTax;
      
      const taxRate = line.percentTaxRate instanceof Decimal 
        ? line.percentTaxRate.toNumber()
        : line.percentTaxRate;
      
      // Convertir le prix HT en TTC (prix stocké en centimes)
      const priceTTC = priceHT * (1 + taxRate / 100);
      
      return {
        product_reference: line.product.ean13 || "",
        product_name: line.product.name || "",
        product_quantity: line.expectedQuantity,
        unit_price_tax_incl: priceTTC, // Prix TTC en centimes
        rate: taxRate,
        specific_price: line.promotion
          ? {
              reduction: line.promotion.amount instanceof Decimal 
                ? line.promotion.amount.toNumber()
                : line.promotion.amount,
              reduction_type: line.promotion.type,
            }
          : undefined,
      };
    });

    // Récupérer le prix de livraison (déjà en centimes dans la DB)
    const deliveryPrice = order.deliveries && order.deliveries.length > 0 
      ? (order.deliveries[0].price instanceof Decimal 
          ? order.deliveries[0].price.toNumber() 
          : order.deliveries[0].price)
      : 0;

    logger.info(`Delivery price HT for order ${order.uuid}: ${deliveryPrice} centimes`);
    logger.info(`Delivery price TTC for order ${order.uuid}: ${deliveryPrice * 1.20} centimes`);

    // Ajouter la ligne frais de port avec le code 270623
    const deliveryPriceTTC = deliveryPrice * 1.20; // Convertir les frais de port HT en TTC (TVA 20%)
    
    const shippingLine = {
      product_reference: "270623",
      product_name: "Frais de port",
      product_quantity: deliveryPriceTTC, // Quantité = prix TTC en centimes
      unit_price_tax_incl: 1, // 1 centime (0.01€ mais stocké en centimes = 1)
      rate: 20.00, // TVA 20%
      specific_price: undefined,
    };

    // Combiner les lignes de produits + ligne frais de port
    const allLines = [...productLines, shippingLine];

    logger.info(`Total lines for order ${order.uuid}: ${allLines.length} (${productLines.length} produits + 1 frais de port)`);

    return {
      numero_vente: uuidMapper.getInt(order.uuid),
      client_id: uuidMapper.getInt(order.uuid),
      uuid: order.uuid,
      nom: customer.lastname,
      prenom: customer.firstname,
      datenaissance: customer.birthday,
      adresse_facturation: billingAddress,
      date_vente: order.createdAt.toISOString().split('T')[0],
      lignevente: allLines,
    };
  });

  return mappedOrders;
};