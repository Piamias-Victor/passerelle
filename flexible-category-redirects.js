// flexible-category-redirects.js
// Script qui gère les redirections de manière flexible, en ignorant la catégorie si nécessaire

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
    ignoreCategories: true, // Nouvelle option pour ignorer les catégories
    handleQueryParams: true // Gestion des paramètres de requête comme ?&onglet=avis
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
    
    // Extraire les colonnes "Ancien Lien" et "Nouveau Lien"
    const redirects = {};
    const productRedirects = new Map(); // Map spéciale pour les redirections par ID de produit
    let skippedCount = 0;
    
    // Traiter chaque ligne du fichier Excel
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
            
            // Si on doit gérer les paramètres de requête, les ajouter au chemin
            if (config.options.handleQueryParams && oldUrl.search) {
              // Nous n'ajoutons pas les paramètres au chemin pour la détection,
              // mais nous les conservons pour l'analyse des produits
            }
          }
          
          // Si le nouveau lien est une URL complète, extraire le chemin
          if (typeof newLink === 'string' && newLink.startsWith('http')) {
            const newUrl = new URL(newLink);
            newPath = newUrl.pathname + newUrl.search;
          }
          
          // Ajouter la redirection standard
          redirects[oldPath] = newPath;
          
          // Extraire l'ID du produit et le code EAN s'ils existent
          // Format typique: /categorie/12345-nom-produit-1234567890123.html
          const productRegex = /\/([^\/]+)\/(\d+)-([^-]+)-?(.*)\.html/;
          const match = oldPath.match(productRegex);
          
          if (match) {
            const category = match[1];
            const productId = match[2];
            const productSlug = match[3];
            const additionalInfo = match[4]; // Peut contenir le code EAN
            
            // 1. Redirection par ID de produit uniquement (ignorant la catégorie)
            if (config.options.ignoreCategories) {
              // Stocker dans notre Map spéciale pour éviter les duplications
              productRedirects.set(productId, {
                oldPath,
                newPath,
                category,
                productSlug,
                additionalInfo
              });
            }
            
            // 2. Essayer d'extraire le code EAN si présent
            if (additionalInfo && /\d{13}/.test(additionalInfo)) {
              const ean = additionalInfo.match(/\d{13}/)[0];
              // On pourrait ajouter une redirection basée sur l'EAN si nécessaire
            }
            
            // 3. Gérer les versions avec et sans accents dans la catégorie
            try {
              // Version décodée (avec accents)
              const decodedPath = decodeURIComponent(oldPath);
              if (decodedPath !== oldPath) {
                redirects[decodedPath] = newPath;
              }
              
              // Version encodée (sans accents)
              const encodedPath = encodeURI(oldPath);
              if (encodedPath !== oldPath) {
                redirects[encodedPath] = newPath;
              }
            } catch (e) {
              // Ignorer les erreurs d'encodage/décodage
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
    
    // Maintenant, ajoutons les redirections spéciales par ID de produit
    if (config.options.ignoreCategories) {
      console.log(`${productRedirects.size} produits uniques extraits pour les redirections flexibles`);
      
      // Ajouter une redirection pour chaque produit, avec n'importe quelle catégorie
      // Format: /{any-category}/{product-id}-{product-slug}.html
      for (const [productId, product] of productRedirects.entries()) {
        // Créer une redirection générique avec wildcard pour la catégorie pour le Worker
        // Note: comme un vrai wildcard n'est pas possible, nous utiliserons un système de lookup dans le Worker
        const productKey = `__PRODUCT_ID__${productId}`;
        redirects[productKey] = product.newPath;
      }
    }
    
    console.log(`${Object.keys(redirects).length} redirections totales générées`);
    if (skippedCount > 0) {
      console.warn(`${skippedCount} lignes ignorées (format incorrect ou colonnes manquantes)`);
    }
    
    return { redirects, productRedirects };
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier Excel:', error);
    throw error;
  }
}

// Générer le Worker avec la redirection flexible
function generateFlexibleWorker(allRedirects, productRedirects) {
  // Diviser les redirections en chunks
  const redirectEntries = Object.entries(allRedirects);
  const chunks = [];
  const chunkSize = config.options.chunkSize;
  
  for (let i = 0; i < redirectEntries.length; i += chunkSize) {
    chunks.push(redirectEntries.slice(i, i + chunkSize));
  }
  
  console.log(`Génération du Worker avec ${chunks.length} chunks de redirections...`);
  
  // Préparer le code pour les redirections par ID de produit
  let productIdCode = '';
  if (config.options.ignoreCategories && productRedirects.size > 0) {
    // Créer un mapping des IDs de produits vers les destinations
    const productIdMapping = Array.from(productRedirects.entries()).map(([id, product]) => 
      `    "${id}": "${product.newPath}"`
    ).join(',\n');
    
    productIdCode = `
    // Mapping des IDs de produits vers les destinations (pour les redirections flexibles)
    const productIdRedirects = {
${productIdMapping}
    };
    
    // Extraction de l'ID du produit, quelle que soit la catégorie
    const productIdMatch = path.match(/\\/[^\\/]+\\/(\\d+)-/);
    if (productIdMatch && productIdMatch[1]) {
      const productId = productIdMatch[1];
      if (productIdRedirects[productId]) {
        return Response.redirect(\`\${newOrigin}\${productIdRedirects[productId]}\`, 301);
      }
    }
    
    // Gestion des paramètres de requête comme ?onglet=avis
    if (${config.options.handleQueryParams} && url.search) {
      // Essayer sans les paramètres de requête
      const pathWithoutQuery = path;
      if (redirects[pathWithoutQuery]) {
        return Response.redirect(\`\${newOrigin}\${redirects[pathWithoutQuery]}\`, 301);
      }
      
      // Essayer d'extraire l'ID du produit à nouveau sans les paramètres
      const productIdMatchWithoutQuery = pathWithoutQuery.match(/\\/[^\\/]+\\/(\\d+)-/);
      if (productIdMatchWithoutQuery && productIdMatchWithoutQuery[1]) {
        const productId = productIdMatchWithoutQuery[1];
        if (productIdRedirects[productId]) {
          return Response.redirect(\`\${newOrigin}\${productIdRedirects[productId]}\`, 301);
        }
      }
    }`;
  }
  
  // Générer le Worker final
  let workerCode = '';
  
  if (chunks.length > 1) {
    // Version multi-chunks
    const chunksCode = chunks.map((chunk, index) => {
      // Filtrer les entrées spéciales de productId
      const filteredChunk = chunk.filter(([key]) => !key.startsWith('__PRODUCT_ID__'));
      
      const redirectsCode = filteredChunk
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

    // Redirections standards par chemin complet
${chunksCode}
${productIdCode}

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
    // Filtrer les entrées spéciales de productId
    const filteredEntries = redirectEntries.filter(([key]) => !key.startsWith('__PRODUCT_ID__'));
    
    const redirectsCode = filteredEntries
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
${productIdCode}

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
    console.log('=== GÉNÉRATION DES REDIRECTIONS FLEXIBLES ===');
    
    // 1. Lire le Worker Cloudflare existant (s'il existe)
    let existingRedirects = {};
    if (config.options.keepExistingRedirects && fs.existsSync(config.files.existingWorker)) {
      console.log(`Lecture du fichier Worker existant: ${config.files.existingWorker}`);
      const existingWorkerContent = fs.readFileSync(config.files.existingWorker, 'utf8');
      existingRedirects = extractExistingRedirects(existingWorkerContent);
    }
    
    // 2. Lire les redirections depuis le fichier Excel
    const { redirects: excelRedirects, productRedirects } = readRedirectionsFromExcel(config.files.excelFile);
    
    // 3. Fusionner les redirections
    const allRedirects = { ...existingRedirects, ...excelRedirects };
    
    console.log(`Redirections existantes: ${Object.keys(existingRedirects).length}`);
    console.log(`Nouvelles redirections: ${Object.keys(excelRedirects).length}`);
    console.log(`Total des redirections: ${Object.keys(allRedirects).length}`);
    
    // 4. Générer le Worker Cloudflare
    console.log('Génération du Worker Cloudflare avec redirection flexible des catégories...');
    const workerContent = generateFlexibleWorker(allRedirects, productRedirects);
    
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