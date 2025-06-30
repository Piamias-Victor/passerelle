import prisma from "../prisma/client"
import { v4 as uuidv4 } from 'uuid'
import { ReductionType } from '@prisma/client'
import { PASSERELLE_CATEGORY_UUID } from "../stock"

function computePriceWithoutTax(prixTtc: number, tva: number): number {
  const ht = prixTtc / (1 + tva / 100);
  return ht * 100;
}

/**
 * Fonction qui crée ou met à jour un produit et ses promotions
 * @param productData 
 */
export async function upsertProduct(productData: {
  codeproduit: string,
  designation: string,
  tva: string,
  stock: string,
  prixttc: string,
  datedrnmodif: string,
  promos?: Array<any> // promos extraites du XML
}) {
  // Conversion des données de base du produit
  const ean13 = productData.codeproduit
  const name = productData.designation
  const stock = parseInt(productData.stock, 10)
  const tva = parseFloat(productData.tva.replace(',', '.'))
  const prixttc = parseFloat(productData.prixttc.replace(',', '.')) // par ex. "4,04" => 4.04


  const priceWithoutTax = computePriceWithoutTax(prixttc, tva)
  const percentTaxRate = tva

  if (ean13 === '3770000717259') console.log('priceWithoutTax :', priceWithoutTax)


  // Vérifier si le produit existe déjà par EAN13
  const existing = await prisma.product.findUnique({
    where: { ean13: ean13 }
  })

  let productUuid: string

  if (existing) {
    // Mise à jour du produit existant
    await prisma.product.update({
      where: { ean13: ean13 },
      data: {
        availableStock: stock,
        priceWithoutTax: priceWithoutTax,
        percentTaxRate: percentTaxRate,
        updatedAt: new Date(),
        updatedBy: "script"
      }
    })
    productUuid = existing.uuid
  } else {
    // Création du nouveau produit
    const newProduct = await prisma.product.create({
      data: {
        uuid: uuidv4(),
        availableStock: stock,
        name: name,
        ean13: ean13,
        // cip13: ean13,
        priceWithoutTax: priceWithoutTax,
        percentTaxRate: percentTaxRate,
        status: "INACTIVE",
        createdAt: new Date(),
        createdBy: "script",
        updatedAt: new Date(),
        updatedBy: "script",
        weight: 0
      }
    })
    productUuid = newProduct.uuid


    // Associer le produit à la catégorie Passerelle
    await prisma.productCategory.create({
      data: {
        productUuid: newProduct.uuid,
        categoryUuid: PASSERELLE_CATEGORY_UUID
      }
    })
  }

  // Gestion des promotions si présentes et actives
  if (productData.promos && productData.promos.length > 0 && !ean13.startsWith("34009")) {
    const originalPrice = parseFloat(productData.prixttc.replace(',', '.'))

    for (const promoXml of productData.promos) {
      const promoPrice = parseFloat(promoXml.prix[0].replace(',', '.'))
      const amount = (originalPrice - promoPrice) * 100
      const active = promoXml.active[0] === '1'
    
      // Convertir en date
      const startDateStr = promoXml.du[0]
      const endDateStr = promoXml.au[0]

      if (startDateStr === "0001-01-01") console.log('startDateStr')
    
      // Vérifier si la date est "0001-01-01", sinon la convertir en objet Date
      const startDate = startDateStr === "0001-01-01" ? undefined : new Date(startDateStr)
      const endDate = endDateStr === "0001-01-01" ? undefined : new Date(endDateStr)

      if (startDateStr === "0001-01-01") console.log('startDate :' , startDate)

    
      if (active) {
        // Créer la promotion
        const promotion = await prisma.promotion.create({
          data: {
            uuid: uuidv4(),
            amount: amount,
            type: ReductionType.FIXED, // Utilisation de l'énumération
            startDate: startDate,
            endDate: endDate,
            createdAt: new Date(),
            createdBy: 'script',
            updatedAt: new Date(),
            updatedBy: 'script',
            name: 'WIN'
          }
        })

        // Lier la promotion au produit
        await prisma.productPromotion.create({
          data: {
            productUuid: productUuid,
            promotionUuid: promotion.uuid
          }
        })

      } else {
      }
    }
  } else {
  }
}