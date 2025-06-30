// src/utils/xmlGenerator.ts

import { create } from 'xmlbuilder2';
import dotenv from 'dotenv';
import { WinpharmaOrder } from '../types/order';
import UuidToIntMapper from './uuidToIntMapper';

dotenv.config();

/**
 * Fonction pour générer le XML des commandes
 * @param orders Tableau de WinpharmaOrder
 * @param uuidMapper Instance de UuidToIntMapper
 * @returns Chaîne XML générée
 */
export const generateOrdersXml = (orders: WinpharmaOrder[], uuidMapper: UuidToIntMapper): string => {
  const numPharma = process.env.WIN_PHARMA_NB || '0000000000';
  const currentDate = new Date().toISOString().split('T')[0];

  console.log('orders', orders[0].lignevente);
  
  const beldemande = {
    beldemande: {
      '@date': currentDate,
      '@version': '1.1',
      '@type': 'SUCCESS',
      infact: {
        vente: orders.map(order => ({
          '@num_pharma': numPharma,
          '@numero_vente': order.numero_vente.toString(), // Conversion en chaîne
          client: {
            '@client_id': order.client_id.toString(),
            nom: order.nom,
            prenom: order.prenom,
            datenaissance: order.datenaissance,
            adresse_facturation: {
              rue1: order.adresse_facturation.rue1,
              rue2: order.adresse_facturation.rue2,
              codepostal: order.adresse_facturation.codepostal,
              ville: order.adresse_facturation.ville,
              pays: order.adresse_facturation.pays,
              tel: order.adresse_facturation.tel,
              portable: order.adresse_facturation.portable,
              email: order.adresse_facturation.email,
            },
          },
          date_vente: order.date_vente,
          lignevente: order.lignevente.map(line => ({
            codeproduit: line.product_reference,
            designation_produit: line.product_name,
            quantite: line.product_quantity.toString(),
            prix_brut: ((line.unit_price_tax_incl / 100) * (1 + (line.rate / 100))).toFixed(2),
            remise: '0.00', // Vous pourriez vouloir ajuster ceci si des remises existent
            prix_net: ((line.unit_price_tax_incl / 100) * (1 + (line.rate / 100))).toFixed(2),
            tauxtva: (line.rate).toFixed(2),
          })),
        })),
      },
    },
  };

  const doc = create(beldemande);
  const xml = doc.end({ prettyPrint: true });

  return xml;
};
