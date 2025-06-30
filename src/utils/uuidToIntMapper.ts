// src/utils/uuidToIntMapper.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Optionnel : Partager une instance de PrismaClient
const prisma = new PrismaClient();

class UuidToIntMapper {
  private mapping: Map<string, number>;
  private filePath: string;
  private currentId: number;
  private logger: winston.Logger;

  private constructor(fileName: string, startingId: number) {
    this.mapping = new Map<string, number>();
    this.filePath = path.join(__dirname, fileName);
    this.currentId = startingId;

    // Configurer le logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(__dirname, 'uuidToIntMapper.log') })
      ],
    });

    this.loadMapping();
  }

  /**
   * Méthode statique asynchrone pour créer une instance de UuidToIntMapper
   * @param fileName Nom du fichier de mappage (optionnel)
   * @returns Instance de UuidToIntMapper
   */
  public static async create(fileName: string = 'uuid-to-int.json'): Promise<UuidToIntMapper> {
    let maxIdResult;

    try {  
      // Récupérer le maximum actuel de idPasserelle
      maxIdResult = await prisma.order.aggregate({
        _max: {
          idPasserelle: true,
        },
      });
    } catch (error: any) {
      throw new Error(`Erreur lors de l'agrégation des commandes : ${error.message}`);
    }

    const maxIdPasserelle = maxIdResult._max.idPasserelle;
    const startingId = (maxIdPasserelle || 0) + 1; // Utilisation de || 0 pour éviter undefined

    return new UuidToIntMapper(fileName, startingId);
  }

  private loadMapping(): void {
    if (fs.existsSync(this.filePath)) {
      const data = fs.readFileSync(this.filePath, 'utf8');
      const obj = JSON.parse(data);
      for (const [uuid, id] of Object.entries(obj)) {
        this.mapping.set(uuid, id as number);
        if ((id as number) >= this.currentId) {
          this.currentId = (id as number) + 1;
        }
      }
    }
  }

  private saveMapping(): void {
    const obj: { [key: string]: number } = {};
    for (const [uuid, id] of this.mapping.entries()) {
      obj[uuid] = id;
    }
    fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
  }

  public getInt(uuid: string): number {
    if (this.mapping.has(uuid)) {
      return this.mapping.get(uuid)!;
    } else {
      const id = this.currentId++;
      this.mapping.set(uuid, id);
      this.saveMapping();
      this.logger.info(`Assigning idPasserelle ${id} to uuid ${uuid}`);
      return id;
    }
  }

  // Getter pour currentId
  public get currentIdValue(): number {
    return this.currentId;
  }
}

export default UuidToIntMapper;
