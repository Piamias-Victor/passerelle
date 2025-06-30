import axios, { InternalAxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { getAdminToken } from './authService';

const baseUrl = 'https://ecommerce-backend-production.admin-a5f.workers.dev';

// Ajouter un intercepteur pour inclure le token admin
axios.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!config.headers) {
    config.headers = new axios.AxiosHeaders();
  }

  const headers = config.headers as AxiosRequestHeaders;

  const token = await getAdminToken();
  headers['Authorization'] = `Bearer ${token}`;

  return config;
});

// Appels API
export async function countProducts(): Promise<number> {
  try {
    const res = await axios.get(`${baseUrl}/admin/count/products`);
    return res.data;
  } catch (error: any) {
    console.error('Erreur lors de la récupération du compte des produits:', error.message);
    throw error;
  }
}

export async function indexProducts(limit: number, offset: number): Promise<void> {
  try {
    await axios.post(`${baseUrl}/admin/products/index`, {
      limit,
      offset,
    });
    console.log(`Indexation réussie pour les produits avec limit=${limit} et offset=${offset}.`);
  } catch (error: any) {
    console.error('Erreur lors de l\'indexation des produits:', error.message);
    throw error;
  }
}
