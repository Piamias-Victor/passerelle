// improved-import-redirects.js
// Script amélioré avec gestion des accents et redirection www vers non-www

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const config = {
  files: {
    excelFile: process.env.EXCEL_FILE || './redirections.xlsx',
    existingWorker: process.env.EXISTING_WORKER || './existing-worker.js',
    outputWorker: process.env.OUTPUT_WORKER || './combined-worker.js'
  },
  options: {
    keepExistingRedirects: true,   // Conserver les redirections existantes
    chunkSize: 500,                // Nombre de redirections par chunk
    redirectWwwToNonWww: true,     // Activer la redirection www vers non-www
    decodePaths: true              // Décoder les URLs avec accents
  }
};

// Fonction pour décoder les URLs avec caractères spéciaux
function decodeUrl(url) {
  try {
    // Décodage des caractères spéciaux (comme %C3%A8 pour è)
    return decodeURIComponent(url);
  } catch (error) {
    console.warn(`Impossible de décoder l'URL: ${url}`, error);
    return url;
  }
}

// Fonction pour extraire les redirections existantes du Worker Cloudflare
function extractExistingRedirects(workerContent) {
  try {
    console.log('Extraction des redirections existantes...');
    
    // Rechercher le bloc de redirections
    const redirectsRegex = /const\s+redirects\s*=\s*{([^}]*)}/s;
    const match = workerContent.match(redirectsRegex);
    
    if (!match || !match[1]) {
      console.warn('Aucune redirection trouvée dans le worker existant');
      return {};
    }
    
    // Extraire chaque paire clé-valeur
    const redirectsText = match[1].trim();
    const redirectEntries = [];
    
    // Utiliser une expression régulière pour extraire les paires clé-valeur
    const pairRegex = /"([^"]+)":\s*"([^"]+)"/g;
    let pairMatch;
    
    while ((pairMatch = pairRegex.exec(redirectsText)) !== null) {
      const [, oldPath, newPath] = pairMatch;
      redirectEntries.push([oldPath, newPath]);
      
      // Si l'option de décodage est activée, ajouter aussi la version décodée
      if (config.options.decodePaths) {
        const decodedPath = decodeUrl(oldPath);
        if (decodedPath !== oldPath) {
          redirectEntries.push([decodedPath, newPath]);
        }
      }
    }
    
    // Convertir en objet
    const redirects = Object.fromEntries(redirectEntries);
    console.log(`${Object.keys(redirects).length} redirections existantes extraites`);
    
    return redirects;
  } catch (error) {
    console.error('Erreur lors de l\'extraction des redirections existantes:', error);
    return {};
  }
}

// Fonction pour lire les redirections depuis un fichier Excel
function readRedirectionsFromExcel(filePath) {
  try {
    console.log(`Lecture du fichier Excel: ${filePath}`);
    
    // Lire le fichier Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir en JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Extraire les colonnes "Ancien Lien" et "Nouveau Lien"
    const redirects = {};
    let skippedCount = 0;
    
    data.forEach(row => {
      // Vérifier si les colonnes existent
      const oldLink = row['Ancien Lien'] || row['ancien lien'] || row['AncienLien'] || row['ancienLien'] || row['Old Link'] || row['old link'] || row['OldLink'] || row['oldLink'];
      const newLink = row['Nouveau Lien'] || row['nouveau lien'] || row['NouveauLien'] || row['nouveauLien'] || row['New Link'] || row['new link'] || row['NewLink'] || row['newLink'];
      
      if (oldLink && newLink) {
        try {
          let oldPath = oldLink;
          let newPath = newLink;
          
          // Si c'est une URL complète, extraire le chemin
          if (typeof oldLink === 'string' && oldLink.startsWith('http')) {
            const oldUrl = new URL(oldLink);
            oldPath = oldUrl.pathname;
          }
          
          // Si le nouveau lien est une URL complète, extraire le chemin
          if (typeof newLink === 'string' && newLink.startsWith('http')) {
            const newUrl = new URL(newLink);
            newPath = newUrl.pathname + newUrl.search;
          }
          
          // Ajouter la redirection
          redirects[oldPath] = newPath;
          
          // Si l'option de décodage est activée, ajouter aussi la version décodée
          if (config.options.decodePaths) {
            const decodedPath = decodeUrl(oldPath);
            if (decodedPath !== oldPath) {
              redirects[decodedPath] = newPath;
            }
          }
        } catch (error) {
          console.warn(`Impossible de parser l'URL: ${oldLink} -> ${newLink}`, error);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    });
    
    console.log(`${Object.keys(redirects).length} redirections extraites du fichier Excel`);
    if (skippedCount > 0) {
      console.warn(`${skippedCount} lignes ignorées (format incorrect ou colonnes manquantes)`);
    }
    
    return redirects;
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier Excel:', error);
    throw error;
  }
}

// Fonction pour générer un Worker avec redirection www vers non-www
function generateWorkerWithWwwRedirect(allRedirects) {
  // Diviser les redirections en chunks
  const chunks = [];
  const entries = Object.entries(allRedirects);
  const chunkSize = config.options.chunkSize;
  
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  
  let workerCode = '';
  
  if (chunks.length > 1) {
    // Générer le code pour chaque chunk
    const chunksCode = chunks.map((chunk, index) => {
      const redirectsCode = chunk
        .map(([oldPath, newPath]) => `        "${oldPath}": "${newPath}"`)
        .join(',\n');
      
      return `    // Chunk ${index + 1}/${chunks.length}
    const redirectsChunk${index + 1} = {
${redirectsCode}
    };
    
    if (redirectsChunk${index + 1}[path]) {
      return Response.redirect(\`\${newOrigin}\${redirectsChunk${index + 1}[path]}\`, 301);
    }`;
    }).join('\n\n');
    
    workerCode = `export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Déterminer l'origine correcte (redirection www vers non-www si nécessaire)
    let newOrigin = url.origin;
    if (${config.options.redirectWwwToNonWww} && url.hostname.startsWith('www.')) {
      newOrigin = url.protocol + '//' + url.hostname.replace(/^www\./, '');
      const nonWwwUrl = newOrigin + url.pathname + url.search;
      return Response.redirect(nonWwwUrl, 301);
    }

${chunksCode}

    // Gérer les erreurs 404 en redirigeant vers la homepage
    const response = await fetch(request);

    if (response.status === 404) {
      return Response.redirect(\`\${newOrigin}/\`, 301);
    }

    // Si aucune redirection ou erreur 404, renvoyez la réponse originale
    return response;
  },
};`;
  } else {
    // Version simple pour moins de redirections
    const redirectsCode = entries
      .map(([oldPath, newPath]) => `      "${oldPath}": "${newPath}"`)
      .join(',\n');
    
    workerCode = `export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Déterminer l'origine correcte (redirection www vers non-www si nécessaire)
    let newOrigin = url.origin;
    if (${config.options.redirectWwwToNonWww} && url.hostname.startsWith('www.')) {
      newOrigin = url.protocol + '//' + url.hostname.replace(/^www\./, '');
      const nonWwwUrl = newOrigin + url.pathname + url.search;
      return Response.redirect(nonWwwUrl, 301);
    }

    // Liste des redirections spécifiques
    const redirects = {
${redirectsCode}
    };

    // Vérifiez si le chemin demandé est dans la liste des redirections
    if (redirects[path]) {
      const targetUrl = \`\${newOrigin}\${redirects[path]}\`;
      return Response.redirect(targetUrl, 301); // Redirection permanente
    }

    // Gérer les erreurs 404 en redirigeant vers la homepage
    const response = await fetch(request);

    if (response.status === 404) {
      return Response.redirect(\`\${newOrigin}/\`, 301); // Redirection permanente
    }

    // Si aucune redirection ou erreur 404, renvoyez la réponse originale
    return response;
  },
};`;
  }
  
  return workerCode;
}

// Fonction principale
async function main() {
  try {
    console.log('=== GÉNÉRATION DES REDIRECTIONS CLOUDFLARE AMÉLIORÉES ===');
    
    // 1. Lire le Worker Cloudflare existant (s'il existe)
    let existingRedirects = {};
    if (config.options.keepExistingRedirects && fs.existsSync(config.files.existingWorker)) {
      console.log(`Lecture du fichier Worker existant: ${config.files.existingWorker}`);
      const existingWorkerContent = fs.readFileSync(config.files.existingWorker, 'utf8');
      existingRedirects = extractExistingRedirects(existingWorkerContent);
    }
    
    // 2. Lire les redirections depuis le fichier Excel
    const excelRedirects = readRedirectionsFromExcel(config.files.excelFile);
    
    // 3. Fusionner les redirections
    const allRedirects = { ...existingRedirects, ...excelRedirects };
    
    console.log(`Redirections existantes: ${Object.keys(existingRedirects).length}`);
    console.log(`Nouvelles redirections: ${Object.keys(excelRedirects).length}`);
    console.log(`Total des redirections: ${Object.keys(allRedirects).length}`);
    
    // 4. Générer le Worker Cloudflare
    console.log('Génération du Worker Cloudflare avec redirection www vers non-www...');
    const workerContent = generateWorkerWithWwwRedirect(allRedirects);
    
    // 5. Écrire le fichier Worker
    console.log(`Écriture du Worker dans: ${config.files.outputWorker}`);
    fs.writeFileSync(config.files.outputWorker, workerContent, 'utf8');
    
    console.log(`Taille du fichier généré: ${workerContent.length} caractères`);
    console.log('=== GÉNÉRATION TERMINÉE AVEC SUCCÈS ===');
  } catch (error) {
    console.error('Erreur lors de la génération du Worker:', error);
  }
}

// Exécuter la fonction principale
main().catch(console.error);