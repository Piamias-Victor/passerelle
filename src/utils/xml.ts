import * as xml2js from 'xml2js'
import { getToday } from './date'
import { getEnvVar } from './env'
import * as fs from 'fs'
import * as path from 'node:path'
import { parseStringPromise } from 'xml2js'

export interface BelDemandeParams {
  date: string
  version: string
  format: string
}

export enum BelDemandeFormat {
  format = 'FORMAT',
  request = 'REQUEST'
}

export const getBelDemandeParams = (format: BelDemandeFormat): BelDemandeParams => {
  return {
    date: getToday(),
    version: '1.1',
    format
  }
}

const pharmaNumberEnv = getEnvVar('WIN_PHARMA_NB')
const pharmaNumber = parseInt(pharmaNumberEnv, 10)
if (isNaN(pharmaNumber)) {
  throw new Error('WIN_PHARMA_NB must be a valid number')
}

export const getStockXmlRequest = (): string => {
  const data = {
    beldemande: {
      $: getBelDemandeParams(BelDemandeFormat.request),
      request: {
        $: {
          type: 'SSTOCK',
          num_pharma: pharmaNumber
        }
      }
    }
  }

  const builder = new xml2js.Builder({
    renderOpts: { 'pretty': true },
    headless: false,
    cdata: true,
    xmldec: { 'version': '1.0', 'encoding': 'UTF-8' }
  })
  return builder.buildObject(data)
}

export async function parseXml(xmlData: string): Promise<any> {
try {
    const result = await parseStringPromise(xmlData, { explicitArray: true })
    return result
} catch (error) {
    throw new Error('Erreur lors du parsing du XML: ' + error)
}
}

export const saveXmlToFile = (xml: string, type = 'export', folderName = 'reports'): string => {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
  const date = new Date()
  const fileName = `${type}-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.xml`
  const filePath = path.join(folderName, fileName)
  fs.writeFileSync(filePath, xml, 'utf8')
  console.log(`XML data saved to ${filePath}`)
  return filePath
}
