import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearProducts() {
  // Supprimer d'abord les références aux produits dans les tables liées
  await prisma.productImage.deleteMany({})
  console.log('Tous les product_images ont été supprimés.')

  await prisma.orderLine.deleteMany({})
  console.log('Tous les order_lines ont été supprimés.')

  // Maintenant qu'aucune table ne référence plus les Products, on peut les supprimer
  await prisma.product.deleteMany({})
  console.log('Tous les produits ont été supprimés.')
}

clearProducts()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
