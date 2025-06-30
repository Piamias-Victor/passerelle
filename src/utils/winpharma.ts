import axios from 'axios'
import * as qs from 'qs'
import { getStockXmlRequest } from './xml'
import { encodeXml } from './encodeXml'

export const sendToWinpharma = async (url: string, login: string, password: string, encodedXml: string): Promise<string> => {
  const content: any = {
    login,
    password,
    data: encodedXml
  }

  const config: any = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Connection': 'close',
      'Accept-Encoding': 'gzip'
    },
    method: 'POST',
    data: qs.stringify(content)
  }

  try {
    const response = await axios(url, config)
    return response.data
  } catch (e: any) {
    throw Error(e.message)
  }
}

export const getStockFromWinpharma = async (url: string, login: string, password: string) => {
  const xml = getStockXmlRequest()
  const encodedXml = await encodeXml(xml)
  return await sendToWinpharma(`${url}/stock/`, login, password, encodedXml)
}

