// src/types.ts

export interface SpecificPrice {
    reduction: number;
    reduction_type: string;
  }
  
  export interface OrderLine {
    product_reference: string;
    product_name: string;
    product_quantity: number;
    unit_price_tax_incl: number;
    rate: number;
    specific_price?: SpecificPrice;
  }
  
  export interface Address {
    rue1: string;
    rue2: string;
    codepostal: string;
    ville: string;
    pays: string;
    tel: string;
    portable: string;
    email: string;
  }
  
  export interface WinpharmaOrder {
    numero_vente: number;     // Entier unique (à vérifier si nécessaire)
    uuid: string;             // Ajouté pour identifier l'ordre
    client_id: number;        // Entier unique
    nom: string;
    prenom: string;
    datenaissance: string;
    adresse_facturation: Address;
    date_vente: string;
    lignevente: OrderLine[];
  }
  