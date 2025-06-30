<?php
/**
 * Script pour générer un flux XML pour Google Merchant à partir des résultats d'une requête SQL
 * 
 * Ce script doit être exécuté après avoir copié les résultats de votre requête SQL dans un fichier CSV.
 */

// Configuration
$outputFile = 'googleshopping-xml.xml'; // Nom du fichier de sortie
$csvFile = 'products_data.csv';         // Fichier CSV contenant les résultats de la requête SQL
$delimiter = ',';                        // Délimiteur du CSV (virgule par défaut)
$enclosure = '"';                        // Caractère d'encadrement du CSV

// Informations sur la boutique
$shopTitle = 'Pharmacie Agnès Praden - Produits santé et bien-être';
$shopDescription = 'Produits de pharmacie, parapharmacie et matériel médical disponibles à la Pharmacie Agnès Praden à Alès.';
$shopLink = 'https://pharmacieagnespraden.com';

// Fonction pour nettoyer une chaîne pour l'inclusion dans le XML
function cleanXml($string) {
    return $string;
}

// Débuter la génération du XML
$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">' . "\n";
$xml .= '<channel>' . "\n";
$xml .= '<title><![CDATA[ ' . $shopTitle . ' ]]></title>' . "\n";
$xml .= '<description><![CDATA[ ' . $shopDescription . ' ]]></description>' . "\n";
$xml .= '<link>' . $shopLink . '</link>' . "\n";

// Lire le fichier CSV
if (($handle = fopen($csvFile, "r")) !== FALSE) {
    // Lire la première ligne (en-têtes)
    $headers = fgetcsv($handle, 0, $delimiter, $enclosure);
    
    // Créer un mapping des indices de colonnes
    $columnMap = array_flip($headers);
    
    // Parcourir chaque ligne du CSV
    while (($data = fgetcsv($handle, 0, $delimiter, $enclosure)) !== FALSE) {
        // Extraire les données du produit
        $id = isset($columnMap['id']) && isset($data[$columnMap['id']]) ? $data[$columnMap['id']] : '';
        $title = isset($columnMap['title']) && isset($data[$columnMap['title']]) ? $data[$columnMap['title']] : '';
        $link = isset($columnMap['link']) && isset($data[$columnMap['link']]) ? $data[$columnMap['link']] : '';
        $description = isset($columnMap['description']) && isset($data[$columnMap['description']]) ? $data[$columnMap['description']] : '';
        $price = isset($columnMap['price']) && isset($data[$columnMap['price']]) ? $data[$columnMap['price']] : '';
        $gtin = isset($columnMap['gtin']) && isset($data[$columnMap['gtin']]) ? $data[$columnMap['gtin']] : '';
        $mpn = isset($columnMap['mpn']) && isset($data[$columnMap['mpn']]) ? $data[$columnMap['mpn']] : '';
        $brand = isset($columnMap['brand']) && isset($data[$columnMap['brand']]) ? $data[$columnMap['brand']] : '';
        $image_link = isset($columnMap['image_link']) && isset($data[$columnMap['image_link']]) ? $data[$columnMap['image_link']] : '';
        $product_type = isset($columnMap['product_type']) && isset($data[$columnMap['product_type']]) ? $data[$columnMap['product_type']] : '';
        $availability = isset($columnMap['availability']) && isset($data[$columnMap['availability']]) ? $data[$columnMap['availability']] : 'in stock';
        $shipping_weight = isset($columnMap['shipping_weight']) && isset($data[$columnMap['shipping_weight']]) ? $data[$columnMap['shipping_weight']] : '';
        $identifier_exists = isset($columnMap['identifier_exists']) && isset($data[$columnMap['identifier_exists']]) ? $data[$columnMap['identifier_exists']] : 'FALSE';
        $is_medicine = isset($columnMap['is_medicine']) && isset($data[$columnMap['is_medicine']]) ? $data[$columnMap['is_medicine']] : 'FALSE';
        $sale_price = isset($columnMap['sale_price']) && isset($data[$columnMap['sale_price']]) ? $data[$columnMap['sale_price']] : '';
        
        // Vérifier si le produit a toutes les informations essentielles
        if (empty($id) || empty($title) || empty($price) || empty($image_link)) {
            continue; // Passer au produit suivant si des informations essentielles sont manquantes
        }
        
        // Générer l'entrée XML pour ce produit
        $xml .= '<item>' . "\n";
        $xml .= '<title><![CDATA[ ' . cleanXml($title) . ' ]]></title>' . "\n";
        $xml .= '<g:id>' . cleanXml($id) . '</g:id>' . "\n";
        $xml .= '<link><![CDATA[ ' . cleanXml($link) . ' ]]></link>' . "\n";
        $xml .= '<g:price><![CDATA[ ' . cleanXml($price) . ' ]]></g:price>' . "\n";
        
        // Ajouter le prix promotionnel s'il existe
        if (!empty($sale_price)) {
            $xml .= '<g:sale_price><![CDATA[ ' . cleanXml($sale_price) . ' ]]></g:sale_price>' . "\n";
        }
        
        $xml .= '<description><![CDATA[ ' . cleanXml($description) . ' ]]></description>' . "\n";
        $xml .= '<g:condition><![CDATA[ new ]]></g:condition>' . "\n";
        
        // Ajouter le GTIN s'il existe
        if (!empty($gtin)) {
            $xml .= '<g:gtin>' . cleanXml($gtin) . '</g:gtin>' . "\n";
        } else {
            $xml .= '<g:gtin/>' . "\n";
        }
        
        // Ajouter le MPN s'il existe
        if (!empty($mpn)) {
            $xml .= '<g:mpn>' . cleanXml($mpn) . '</g:mpn>' . "\n";
        } else {
            $xml .= '<g:mpn/>' . "\n";
        }
        
        // Ajouter la marque s'il existe
        if (!empty($brand)) {
            $xml .= '<g:brand><![CDATA[ ' . cleanXml($brand) . ' ]]></g:brand>' . "\n";
        } else {
            $xml .= '<g:brand/>' . "\n";
        }
        
        $xml .= '<g:image_link><![CDATA[ ' . cleanXml($image_link) . ' ]]></g:image_link>' . "\n";
        $xml .= '<g:product_type><![CDATA[ ' . cleanXml($product_type) . ' ]]></g:product_type>' . "\n";
        $xml .= '<g:availability><![CDATA[ ' . cleanXml($availability) . ' ]]></g:availability>' . "\n";
        $xml .= '<g:quantity>0</g:quantity>' . "\n";
        
        // Ajouter les informations d'expédition
        $xml .= '<g:shipping>' . "\n";
        $xml .= '<g:country>FR</g:country>' . "\n";
        $xml .= '<g:price>0</g:price>' . "\n";
        $xml .= '</g:shipping>' . "\n";
        
        // Ajouter l'information de poids d'expédition s'il existe
        if (!empty($shipping_weight)) {
            $xml .= '<g:shipping_weight>' . cleanXml($shipping_weight) . '</g:shipping_weight>' . "\n";
        }
        
        $xml .= '<g:identifier_exists>' . cleanXml($identifier_exists) . '</g:identifier_exists>' . "\n";
        $xml .= '<g:adwords_grouping/>' . "\n";
        $xml .= '<g:adwords_labels/>' . "\n";
        $xml .= '<g:adult>FALSE</g:adult>' . "\n";
        $xml .= '</item>' . "\n";
    }
    
    fclose($handle);
}

// Finaliser le XML
$xml .= '</channel>' . "\n";
$xml .= '</rss>';

// Écrire le XML dans un fichier
file_put_contents($outputFile, $xml);

echo "Le fichier XML a été généré avec succès : $outputFile\n";