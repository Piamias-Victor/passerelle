import prisma from "./prisma/client";
import { upsertProduct } from "./services/productService";
import { getEnvVar } from "./utils/env";
import { getStockFromWinpharma } from "./utils/winpharma";
import { parseXml } from "./utils/xml";
import fs from 'fs';
import { countProducts, indexProducts } from './services/apiService';

// UUID de la catégorie Passerelle
export const PASSERELLE_CATEGORY_UUID = 'e1402501-b888-4242-9e30-d7c4c85e76fa';

// Codes à tester spécifiquement
const TEST_CODES = ['8809937360834', '3282770204681'];

async function main() {
  // console.log('Démarrage de la récupération et de la mise à jour des produits et promotions...');

  const winpharmaUrl = getEnvVar('WIN_URL');
  const login = getEnvVar('WIN_LOGIN');
  const password = getEnvVar('WIN_PASSWORD');

  try {
    // Récupérer le fichier XML depuis Winpharma
    const xmlData = await getStockFromWinpharma(winpharmaUrl, login, password);
    fs.writeFileSync('winpharma-data.xml', xmlData, 'utf8');
    console.log('XML récupéré et sauvegardé avec succès dans winpharma-data.xml.');
  } catch (error: any) {
    console.error('Erreur lors de la récupération du XML :', error.message);
    // Si la récupération du XML échoue, arrêter le script
    return;
  }

  try {
    // Lire et parser le fichier XML
    const xmlContent = fs.readFileSync('winpharma-data.xml', 'utf8');
    const response = await parseXml(xmlContent);
    const products = response.belreponse.sstock[0].produit;

    console.log(`Nombre de produits trouvés dans le XML: ${products.length}`);

    // Créer un Set de codes produits présents dans le XML pour recherche rapide
    const xmlProductCodes = new Set(products.map((p: any) => p.codeproduit[0]));
    
    // 1. Mettre à jour les produits présents dans le XML
    for (const productObj of products) {
      let promotions: Array<any> = [];
      if (productObj.promos && productObj.promos.length > 0 && productObj.promos[0].promo) {
        promotions = productObj.promos[0].promo;
      }
      
      await upsertProduct({
        codeproduit: productObj.codeproduit[0],
        designation: productObj.designation[0],
        tva: productObj.tva[0],
        stock: productObj.stock[0],
        prixttc: productObj.prixttc[0],
        datedrnmodif: productObj.datedrnmodif[0],
        promos: promotions,
      });
    }

    // 2. Récupérer tous les produits de la base de données
    const dbProducts = await prisma.product.findMany({
      select: {
        uuid: true,
        ean13: true,
        availableStock: true
      }
    });

    console.log(`Nombre de produits dans la base de données: ${dbProducts.length}`);

    // 3. Identifier les produits présents dans la BD mais absents du XML
    const productsToUpdate = dbProducts.filter(dbProduct => !xmlProductCodes.has(dbProduct.ean13));
    
    console.log(`Nombre de produits à mettre à 0 en stock: ${productsToUpdate.length}`);

    // 4. Pour chaque produit absent du XML, mettre le stock à 0
    for (const product of productsToUpdate) {
      await prisma.product.update({
        where: { uuid: product.uuid },
        data: { availableStock: 0 }
      });
      
      // Pour les codes de test, afficher un message spécifique
      if (TEST_CODES.includes(product.ean13)) {
        console.log(`Code test ${product.ean13} trouvé dans la base mais pas dans le XML - Stock mis à 0`);
      }
    }

    // Vérifier spécifiquement les codes de test
    for (const testCode of TEST_CODES) {
      const inXml = xmlProductCodes.has(testCode);
      const inDb = dbProducts.some(p => p.ean13 === testCode);
      
      console.log(`Code test ${testCode}:`);
      console.log(`  - Présent dans XML: ${inXml ? 'Oui' : 'Non'}`);
      console.log(`  - Présent dans BD: ${inDb ? 'Oui' : 'Non'}`);
      
      if (inDb) {
        const product = await prisma.product.findFirst({
          where: { ean13: testCode },
          select: { availableStock: true }
        });
        console.log(`  - Stock actuel: ${product?.availableStock}`);
      }
    }

    console.log('Mise à jour des produits et promotions terminée.');

  } catch (error: any) {
    console.error('Erreur lors du traitement du XML :', error.message);
    return; // Arrêter le script en cas d'erreur de traitement
  }

  // Appeler les nouvelles fonctions après la mise à jour des produits
  try {
    const totalProducts = await countProducts();
    console.log(`Total des produits dans le backend: ${totalProducts}`);

    const limit = 100; // Par exemple, nombre de produits par lot
    let offset = 0;

    while (offset < totalProducts) {
      await indexProducts(limit, offset);
      offset += limit;
    }

    console.log('Indexation des produits terminée.');
  } catch (error: any) {
    console.error('Erreur lors de l\'appel des API backend :', error.message);
  }
}

main()
  .catch(e => {
    console.error('Erreur inattendue dans le script :', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });