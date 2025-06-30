export const utf8Encode = (str: string) => {
    return Buffer.from(str, 'utf-8').toString()
  }
  
  export const removeAccents = (str: string): string => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  export const cleanAndFormatString = (str: string): string => {
    str = str.trim()
    str = str.replace(/[\s'\/\[\]:-]+/g, ' ')
    str = str.replace(/[ \/]/g, '-')
    return str
  }
  
  export const formatForCdata = (str: string, maxLength: number): string => {
    let res = utf8Encode(str)
    res = res.toLowerCase()
    res = removeAccents(res)
    res = cleanAndFormatString(res)
    res = res.replace(utf8Encode('n°'), 'num')
    res = res.replace('n°', 'num')
    res = res.substring(0, maxLength)
    return res
  }
  