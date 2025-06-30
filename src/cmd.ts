// src/sendXmlFromPrisma.ts

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import winston from 'winston';
import zlib from 'zlib';
import { PrismaClient } from '@prisma/client';
import { generateOrdersXml } from './utils/xmlGenerator';
import { getOrdersToExport } from './services/orderService';
import UuidToIntMapper from './utils/uuidToIntMapper';
import { WinpharmaOrder } from './types/order';

dotenv.config();

const WIN_URL = process.env.WIN_URL;
const WIN_LOGIN = process.env.WIN_LOGIN;
const WIN_PASSWORD = process.env.WIN_PASSWORD;
const WIN_PHARMA_NB = process.env.WIN_PHARMA_NB;

if (!WIN_URL || !WIN_LOGIN || !WIN_PASSWORD || !WIN_PHARMA_NB) {
  console.error('Les variables d\'environnement WIN_URL, WIN_LOGIN, WIN_PASSWORD et WIN_PHARMA_NB doivent être définies.');
  process.exit(1);
}

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'sendXmlFromPrisma.log') })
  ],
});

const prisma = new PrismaClient();

// Fonction principale pour récupérer les données, générer le XML et l'envoyer
const generateAndSendXml = async (): Promise<void> => {
  let uuidMapper: UuidToIntMapper | null = null;
  try {
    logger.info('Récupération du max idPasserelle depuis Prisma...');

    // Initialiser le mapper avec le startingId via la méthode statique create
    uuidMapper = await UuidToIntMapper.create('uuid-to-int.json');
    logger.info(`Starting ID passerelle: ${uuidMapper.currentIdValue}`);

    logger.info('Récupération des données des commandes depuis Prisma...');

    // Récupérer les données réelles des commandes sans idPasserelle
    const exportedOrders: WinpharmaOrder[] = await getOrdersToExport(uuidMapper);

    logger.info(exportedOrders[0].lignevente[0])

    logger.info(`Nombre de commandes récupérées : ${exportedOrders.length}`);

    if (exportedOrders.length === 0) {
      logger.info('Aucune commande à exporter.');
      return;
    }

    // Générer le XML en passant uuidMapper
    logger.info('Génération du fichier XML...');
    logger.info('dasn cmd exportedOrders :', exportedOrders);
    const xmlContent = generateOrdersXml(exportedOrders, uuidMapper);

    // Définir le chemin pour enregistrer le fichier XML (optionnel)
    const xmlFilePath = path.join(__dirname, 'exports', 'orders-export.xml');
    fs.mkdirSync(path.dirname(xmlFilePath), { recursive: true });
    fs.writeFileSync(xmlFilePath, xmlContent, 'utf8');
    logger.info(`Fichier XML généré et enregistré à : ${xmlFilePath}`);

    // Envoyer le fichier XML à Winpharma
    const endpoint = 'demande'; // Sans slash, le script ajoutera automatiquement
    await sendXmlToWinpharma(WIN_LOGIN, WIN_PASSWORD, xmlContent, endpoint);

    // Après envoi réussi, mettre à jour les commandes avec idPasserelle
    for (const order of exportedOrders) {
      const passId = uuidMapper.getInt(order.uuid); // Utiliser uuid pour mapper

      logger.info(`Assigning idPasserelle ${passId} to order UUID ${order.uuid}`);

      await prisma.order.update({
        where: { uuid: order.uuid }, // Utiliser uuid au lieu de id
        data: { idPasserelle: passId },
      });

      logger.info(`Commande UUID ${order.uuid} mise à jour avec idPasserelle ${passId}.`);
    }
  } catch (error: any) {
    logger.error(`Erreur lors de la génération ou de l'envoi du XML : ${error.message}`);
  } finally {
    if (uuidMapper) {
      // Si nécessaire, effectuez des opérations supplémentaires sur uuidMapper ici
    }

    // Déconnecter Prisma Client
    await prisma.$disconnect();
    logger.info('Déconnexion de Prisma Client.');
  }
};

// Exécuter le script
generateAndSendXml()
  .then(() => {
    logger.info('Script terminé.');
  })
  .catch(error => {
    logger.error(`Erreur inattendue : ${error.message}`);
  });

// Fonction pour envoyer le fichier XML
const sendXmlToWinpharma = async (login: string, password: string, xmlContent: string, endpoint: string): Promise<void> => {
  try {
    logger.info('Compression et encodage du fichier XML...');

    // Compresser le XML avec GZip
    const compressed = zlib.gzipSync(xmlContent);

    // Encoder le fichier compressé en Base64
    const encoded = compressed.toString('base64');

    // Préparer les données de formulaire URL-encodées
    const formData = new URLSearchParams();
    formData.append('login', login);
    formData.append('password', password);
    formData.append('data', encoded);

    logger.info('Envoi du fichier XML à Winpharma...');

    // Construire l'URL complète avec l'endpoint
    const urlToSend = `${WIN_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}/`; // Assure qu'il y a un seul slash entre les parties

    logger.info(`URL d'envoi: ${urlToSend}`);

    // Envoyer le XML via une requête HTTP POST
    const response = await axios.post(urlToSend, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'gzip',
      },
      timeout: 10000, // Timeout de 10 secondes
    });

    // Vérifier la réponse
    if (response.status === 200) {
      logger.info('XML envoyé avec succès à Winpharma.');
      // Ici, si l'API retourne un winpharmaId, vous pouvez le récupérer
      // Exemple : const winpharmaId = response.data.winpharmaId;
      // Sinon, utilisez le mapper pour assigner l'ID localement
    } else {
      logger.error(`Échec de l'envoi du XML à Winpharma. Statut : ${response.status}`);
    }
  } catch (error: any) {
    if (error.response) {
      // La requête a été faite et le serveur a répondu avec un statut en dehors de 2xx
      logger.error(`Erreur de réponse du serveur : ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      logger.error(`Aucune réponse reçue du serveur : ${error.request}`);
    } else {
      // Quelque chose s'est passé lors de la configuration de la requête
      logger.error(`Erreur lors de la configuration de la requête : ${error.message}`);
    }
  }
};
