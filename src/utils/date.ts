export const getToday = (): string => {
    return getFormattedDate(new Date().toISOString())
  }
  
  export const getFormattedDate = (date: string): string => {
    return date.split('T')[0]
  }
  