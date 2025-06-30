import * as zlib from 'zlib'
import * as util from 'util'
const gzip = util.promisify(zlib.gzip)

export const encodeXml = async (xml: string): Promise<string> => {
  try {
    const buffer = await gzip(xml)
    return buffer.toString('base64')
  } catch (err) {
    console.error('Error compressing XML:', err)
    throw err
  }
}
