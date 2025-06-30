// services/authService.ts
const KEYCLOAK_URL = 'https://keycloak.phardev.fr';
const REALM = 'Phardev';
const CLIENT_ID = 'admin-cli';
const ADMIN_USERNAME = 'admin@phardev.fr';
const ADMIN_PASSWORD = 'totototo';

export async function getAdminToken(): Promise<string> {
  try {
    const response = await fetch(`${KEYCLOAK_URL}/realms/Phardev/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        grant_type: 'password',
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération du token admin 1 : ${response.statusText}`);
    }

    const data = await response.json();

    return data.access_token;
  } catch (error: any) {
    console.error('Erreur lors de la récupération du token admin 2:', error.message);
    throw error;
  }
}
