// src/generateXml.ts
import fs from 'fs';
import path from 'path';
import { getOrdersToExport } from './services/orderService';
import { generateOrdersXml } from './utils/xmlGenerator';
import UuidToIntMapper from './utils/uuidToIntMapper';
import winston from 'winston';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

// Configurer les logs
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
    new winston.transports.File({ filename: path.join(logsDir, 'generateXml.log') })
  ],
});

// Initialiser PrismaClient (si vous ne partagez pas une instance globale)
const prisma = new PrismaClient();

// Fonction principale pour générer et sauvegarder le XML
const exportOrdersToXml = async (): Promise<void> => {
  let uuidMapper: UuidToIntMapper | null = null;
  try {
    logger.info('Initialisation de UuidToIntMapper...');
    
    // Initialiser le mapper avec le startingId via la méthode statique create
    uuidMapper = await UuidToIntMapper.create('uuid-to-int.json');
    logger.info(`Starting ID passerelle: ${uuidMapper.currentIdValue}`);
    
    logger.info('Récupération des données des commandes depuis Prisma...');
    
    // Récupérer les données réelles des commandes sans id_passerelle
    const exportedOrders = await getOrdersToExport(uuidMapper);
    
    logger.info(`Nombre de commandes récupérées : ${exportedOrders.length}`);
    
    if (exportedOrders.length === 0) {
      logger.info('Aucune commande à exporter.');
      return;
    }
    
    // Générer le XML en passant uuidMapper
    logger.info('Génération du fichier XML...');
    logger.info('exportedOrders :', exportedOrders);
    const xmlContent = generateOrdersXml(exportedOrders, uuidMapper);
    
    // Définir le chemin pour enregistrer le fichier XML (optionnel)
    const xmlFilePath = path.join(__dirname, 'exports', 'orders-export.xml');
    fs.mkdirSync(path.dirname(xmlFilePath), { recursive: true });
    fs.writeFileSync(xmlFilePath, xmlContent, 'utf8');
    logger.info(`Fichier XML généré et enregistré à : ${xmlFilePath}`);
    
  } catch (error: any) {
    logger.error(`Erreur lors de l'exportation des commandes : ${error.message}`);
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
exportOrdersToXml()
  .then(() => {
    logger.info('Script terminé avec succès.');
  })
  .catch(error => {
    logger.error(`Erreur inattendue : ${error.message}`);
  });
