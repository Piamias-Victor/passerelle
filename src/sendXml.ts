// src/sendXmlTest.ts
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import winston from 'winston';
import zlib from 'zlib';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config();

// Récupérer les variables d'environnement
const WIN_URL = process.env.WIN_URL;
const WIN_LOGIN = process.env.WIN_LOGIN;
const WIN_PASSWORD = process.env.WIN_PASSWORD;
const WIN_PHARMA_NB = process.env.WIN_PHARMA_NB;

// Vérifier que toutes les variables d'environnement nécessaires sont définies
if (!WIN_URL || !WIN_LOGIN || !WIN_PASSWORD || !WIN_PHARMA_NB) {
  console.error('Les variables d\'environnement WIN_URL, WIN_LOGIN, WIN_PASSWORD et WIN_PHARMA_NB doivent être définies.');
  process.exit(1);
}

// Configurer le logger avec Winston
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
    new winston.transports.File({ filename: path.join(logsDir, 'sendXmlTest.log') })
  ],
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
      // Optionnel : Ajouter la logique pour marquer les commandes comme traitées
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

// Fonction principale pour lire et envoyer le fichier XML
const sendPreGeneratedXml = async (): Promise<void> => {
  try {
    // Définir le chemin du fichier XML
    const xmlFilePath = path.join(__dirname, 'exports', 'orders-export.xml');
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(xmlFilePath)) {
      logger.error(`Le fichier XML spécifié n'existe pas : ${xmlFilePath}`);
      return;
    }
    
    // Lire le contenu du fichier XML
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf8');
    logger.info(`Fichier XML lu depuis ${xmlFilePath}`);
    
    // Définir l'endpoint pour les demandes de factures
    const endpoint = 'demande'; // Sans slash, le script ajoutera automatiquement
    
    // Envoyer le fichier XML à Winpharma
    await sendXmlToWinpharma(WIN_LOGIN, WIN_PASSWORD, xmlContent, endpoint);
  } catch (error: any) {
    logger.error(`Erreur lors de la lecture ou de l'envoi du fichier XML: ${error.message}`);
  }
};

// Exécuter le script
sendPreGeneratedXml().then(() => {
  logger.info('Script terminé.');
}).catch(error => {
  logger.error(`Erreur inattendue : ${error.message}`);
});
