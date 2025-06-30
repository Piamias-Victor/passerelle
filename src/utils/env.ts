export const getEnvVar = (name: string): string => {
    const value = process.env[name]
    if (!value) {
      throw new Error(`Env variable ${name} is not defined`)
    }
    return value
  }
  