export interface deploymentOptions {
    dbConfig: dbConfig,
    filePath: string,
    tsConfigPath: string,
    rollupConfigPath: string
}

export interface transpileOptions {
    tsConfigPath: string,
    sourcePath: string
}

export interface dbConfig {
    username: string,
    password: string,
    host: string,
    port: number,
    service: string,
}