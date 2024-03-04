export interface IDatabaseConfig {
    host: string;
    port: number;
    database: string;
    schema: string;
    user: string;
    password: string;

    minConnections?: number;
    maxConnections?: number;
}
