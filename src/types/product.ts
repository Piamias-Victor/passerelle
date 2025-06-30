// src/types/product.ts

export interface PromoXml {
    prix: string[]
    active: string[]
    du: string[]
    au: string[]
  }
  
  export interface ProductXml {
    codeproduit: string[]
    designation: string[]
    tva: string[]
    stock: string[]
    prixttc: string[]
    datedrnmodif: string[]
    promos?: {
      promo?: PromoXml[]
    }[]
  }
  
  export interface ParsedXml {
    belreponse: {
      sstock: {
        produit: ProductXml[]
      }[]
    }
  }
  