// reference-handling-redirects.js
// Script qui gère les redirections avec et sans référence à la fin de l'URL

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
    keepExistingRedirects: true,
    chunkSize: 500,
    redirectWwwToNonWww: true,
    handleReferences: true, // Nouvelle option pour gérer les références
    handleAccents: true     // Gestion des accents
  }
};

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

// Fonction pour créer une version avec accents encodés
function createEncodedVersion(path) {
  try {
    // Nous allons créer une version encodée manuellement pour les caractères les plus courants
    let encodedPath = path;
    
    // Remplacer les caractères avec accents par leurs équivalents encodés
    encodedPath = encodedPath.replace(/é/g, '%C3%A9');
    encodedPath = encodedPath.replace(/è/g, '%C3%A8');
    encodedPath = encodedPath.replace(/ê/g, '%C3%AA');
    encodedPath = encodedPath.replace(/ë/g, '%C3%AB');
    encodedPath = encodedPath.replace(/à/g, '%C3%A0');
    encodedPath = encodedPath.replace(/â/g, '%C3%A2');
    encodedPath = encodedPath.replace(/ä/g, '%C3%A4');
    encodedPath = encodedPath.replace(/î/g, '%C3%AE');
    encodedPath = encodedPath.replace(/ï/g, '%C3%AF');
    encodedPath = encodedPath.replace(/ù/g, '%C3%B9');
    encodedPath = encodedPath.replace(/û/g, '%C3%BB');
    encodedPath = encodedPath.replace(/ü/g, '%C3%BC');
    encodedPath = encodedPath.replace(/ô/g, '%C3%B4');
    encodedPath = encodedPath.replace(/ö/g, '%C3%B6');
    encodedPath = encodedPath.replace(/ç/g, '%C3%A7');
    
    return encodedPath;
  } catch (e) {
    return path;
  }
}

// Fonction pour ajouter les variations d'accents à un chemin
function addAccentVariations(path, newPath, redirects) {
  // Ajouter la redirection de base
  redirects[path] = newPath;
  
  // Si le chemin contient déjà des accents, ajouter la version encodée
  if (/[éèêëàâäîïùûüôöç]/i.test(path)) {
    const encodedPath = createEncodedVersion(path);
    if (encodedPath !== path) {
      redirects[encodedPath] = newPath;
    }
    
    return; // Pas besoin d'ajouter des accents si le chemin en contient déjà
  }
  
  // Rechercher spécifiquement certains mots courants qui peuvent avoir des accents
  const accentWords = {
    'hygiene': 'hygiène',
    'sante': 'santé',
    'beaute': 'beauté',
    'creme': 'crème',
    'pharmacie': 'pharmacie', // pas d'accent mais pour l'exemple
    'general': 'général',
    'medicament': 'médicament',
    'anti-age': 'anti-âge',
    'regenerant': 'régénérant',
    'proteine': 'protéine',
    'special': 'spécial',
    'pere': 'père',
    'mere': 'mère',
    'frere': 'frère',
    'fievre': 'fièvre',
    'probleme': 'problème',
    'qualite': 'qualité',
    'the': 'thé',
    'anxiete': 'anxiété'
  };
  
  // Vérifier si le chemin contient l'un des mots courants
  let modifiedPath = path;
  for (const [word, accentWord] of Object.entries(accentWords)) {
    // Utiliser une regex avec word boundary pour éviter les remplacements partiels
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(modifiedPath)) {
      // Créer une version avec l'accent
      const accentPath = modifiedPath.replace(regex, accentWord);
      if (accentPath !== modifiedPath) {
        redirects[accentPath] = newPath;
        
        // Ajouter aussi la version encodée
        const encodedAccentPath = createEncodedVersion(accentPath);
        if (encodedAccentPath !== accentPath) {
          redirects[encodedAccentPath] = newPath;
        }
      }
    }
  }
}

// Fonction pour créer une version sans référence (EAN) à la fin
function createWithoutReferenceVersion(path) {
  // Regex pour détecter un fichier .html avec un code de référence à la fin
  // Format typique: /chemin/12345-nom-produit-1234567890123.html
  const refRegex = /^(.*-[^-]+)(-\d{13})\.html$/;
  const match = path.match(refRegex);
  
  if (match) {
    // Recréer le chemin sans la référence
    return `${match[1]}.html`;
  }
  
  return null; // Pas de version sans référence
}

// Fonction pour créer une version avec référence (EAN) à la fin
function createWithReferenceVersion(path, reference) {
  // Vérifier si le chemin se termine déjà par .html et ne contient pas déjà la référence
  const htmlRegex = /^(.*-[^-]+)\.html$/;
  const match = path.match(htmlRegex);
  
  if (match && reference && !path.includes(reference)) {
    // Ajouter la référence avant .html
    return `${match[1]}-${reference}.html`;
  }
  
  return null; // Pas de version avec référence possible
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
    console.log(`Nombre d'entrées dans le fichier Excel: ${data.length}`);
    
    // Extraire les colonnes "Ancien Lien", "Nouveau Lien" et "Reference"
    const redirects = {};
    let skippedCount = 0;
    let referenceVariationsCount = 0;
    
    // Traiter chaque ligne du fichier Excel
    data.forEach(row => {
      // Vérifier si les colonnes existent
      const reference = row['Reference'] || row['reference'] || row['Référence'] || row['référence'] || row['EAN'] || row['ean'] || row['EAN13'] || row['ean13'];
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
          
          // 1. Ajouter la redirection principale avec variations d'accents
          if (config.options.handleAccents) {
            addAccentVariations(oldPath, newPath, redirects);
          } else {
            redirects[oldPath] = newPath;
          }
          
          // 2. Gérer les versions avec/sans référence si l'option est activée
          if (config.options.handleReferences) {
            // 2.1. Si le chemin contient déjà une référence, créer une version sans référence
            const withoutRefPath = createWithoutReferenceVersion(oldPath);
            if (withoutRefPath) {
              redirects[withoutRefPath] = newPath;
              referenceVariationsCount++;
              
              // Ajouter aussi les variations d'accents pour cette version
              if (config.options.handleAccents) {
                addAccentVariations(withoutRefPath, newPath, redirects);
              }
            }
            
            // 2.2. Si le chemin ne contient pas de référence mais qu'on a une référence, créer une version avec référence
            else if (reference) {
              const withRefPath = createWithReferenceVersion(oldPath, reference);
              if (withRefPath) {
                redirects[withRefPath] = newPath;
                referenceVariationsCount++;
                
                // Ajouter aussi les variations d'accents pour cette version
                if (config.options.handleAccents) {
                  addAccentVariations(withRefPath, newPath, redirects);
                }
              }
            }
          }
          
          // 3. Essayer de décoder les URLs pour gérer les cas spéciaux
          try {
            const decodedPath = decodeURIComponent(oldPath);
            if (decodedPath !== oldPath && !redirects[decodedPath]) {
              redirects[decodedPath] = newPath;
            }
          } catch (e) {
            // Ignorer les erreurs de décodage
          }
          
        } catch (error) {
          console.warn(`Impossible de parser l'URL: ${oldLink} -> ${newLink}`, error);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    });
    
    const baseRedirectsCount = data.length - skippedCount;
    console.log(`${baseRedirectsCount} redirections de base extraites du fichier Excel`);
    if (referenceVariationsCount > 0) {
      console.log(`${referenceVariationsCount} variations avec/sans référence ajoutées`);
    }
    console.log(`${Object.keys(redirects).length} redirections totales (avec variations)`);
    
    if (skippedCount > 0) {
      console.warn(`${skippedCount} lignes ignorées (format incorrect ou colonnes manquantes)`);
    }
    
    return redirects;
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier Excel:', error);
    throw error;
  }
}

// Générer le Worker avec toutes les fonctionnalités
function generateWorker(allRedirects) {
  // Diviser les redirections en chunks
  const chunks = [];
  const entries = Object.entries(allRedirects);
  const chunkSize = config.options.chunkSize;
  
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  
  console.log(`Génération du Worker avec ${chunks.length} chunks de redirections...`);
  
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
    
    // Redirection www vers non-www
    let newOrigin = url.origin;
    if (${config.options.redirectWwwToNonWww} && url.hostname.startsWith('www.')) {
      newOrigin = url.protocol + '//' + url.hostname.replace(/^www\./, '');
      const nonWwwUrl = newOrigin + url.pathname + url.search;
      return Response.redirect(nonWwwUrl, 301);
    }

${chunksCode}

    // Essayer avec la version décodée pour les caractères spéciaux
    try {
      const decodedPath = decodeURIComponent(path);
      if (decodedPath !== path) {
        // Vérifier dans chaque chunk de redirections
        ${chunks.map((chunk, index) => `
        if (redirectsChunk${index + 1}[decodedPath]) {
          return Response.redirect(\`\${newOrigin}\${redirectsChunk${index + 1}[decodedPath]}\`, 301);
        }`).join('')}
      }
    } catch(e) {
      // Ignorer les erreurs de décodage
    }

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
    
    // Redirection www vers non-www
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
      return Response.redirect(targetUrl, 301);
    }

    // Essayer avec la version décodée pour les caractères spéciaux
    try {
      const decodedPath = decodeURIComponent(path);
      if (decodedPath !== path && redirects[decodedPath]) {
        const targetUrl = \`\${newOrigin}\${redirects[decodedPath]}\`;
        return Response.redirect(targetUrl, 301);
      }
    } catch(e) {
      // Ignorer les erreurs de décodage
    }

    // Gérer les erreurs 404 en redirigeant vers la homepage
    const response = await fetch(request);

    if (response.status === 404) {
      return Response.redirect(\`\${newOrigin}/\`, 301);
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
    console.log('=== GÉNÉRATION DES REDIRECTIONS AVEC GESTION DES RÉFÉRENCES ===');
    
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
    console.log('Génération du Worker Cloudflare...');
    const workerContent = generateWorker(allRedirects);
    
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