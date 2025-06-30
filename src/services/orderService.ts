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
      lines: {
        include: {
          product: true,
          promotion: true,
        },
      },
    },
  });

  const mappedOrders: WinpharmaOrder[] = orders.map(order => {
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

    return {
      numero_vente: uuidMapper.getInt(order.uuid),
      client_id: uuidMapper.getInt(order.uuid),
      uuid: order.uuid, // <-- Ajoutez cette ligne
      nom: customer.lastname,
      prenom: customer.firstname,
      datenaissance: customer.birthday,
      adresse_facturation: billingAddress,
      date_vente: order.createdAt.toISOString().split('T')[0],
      lignevente: order.lines.map(line => ({
        product_reference: line.product.ean13 || "",
        product_name: line.product.name || "",
        product_quantity: line.expectedQuantity,
        unit_price_tax_incl: line.priceWithoutTax instanceof Decimal 
          ? line.priceWithoutTax.toNumber() // ✅ Convertir en number
          : line.priceWithoutTax,
        rate: line.percentTaxRate instanceof Decimal 
          ? line.percentTaxRate.toNumber() // ✅ Convertir en number
          : line.percentTaxRate,
        specific_price: line.promotion
          ? {
              reduction: line.promotion.amount instanceof Decimal 
                ? line.promotion.amount.toNumber() // ✅ Convertir en number
                : line.promotion.amount,
              reduction_type: line.promotion.type,
            }
          : undefined,
      })),
    };
  });

  return mappedOrders;
};
