#!/bin/bash

# Définir les variables d'environnement si nécessaire
# export NODE_ENV=production

# Chemin absolu vers le projet
PROJECT_DIR="/home/ec2-user/winPasserelle"

# Naviguer vers le répertoire du projet
cd "$PROJECT_DIR" || { echo "Échec de la navigation vers $PROJECT_DIR"; exit 1; }

# Activer l'environnement Node.js si vous utilisez nvm ou un autre gestionnaire
# source ~/.nvm/nvm.sh
# nvm use node_version

# Exécuter le script TypeScript
/usr/bin/env npx ts-node src/stock.ts >> logs/run-stock.log 2>&1

# Vérifier l'état de sortie et loguer si nécessaire
if [ $? -eq 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO]: run-stock.sh exécuté avec succès." >> logs/run-stock.log
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR]: run-stock.sh a échoué." >> logs/run-stock.log
fi
