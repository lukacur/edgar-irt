import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { IDatabaseConfig } from "../Models/Config/DatabaseConfig.model.js"
import pg from 'pg';
import { TransactionContext } from "./TransactionContext.js";

const { Pool } = pg;

export type QueryReturn<TResult> = {
    rows: TResult[],
    count: number,
}

export class DatabaseConnection {
    private pool: pg.Pool | null = null;

    private setupPooledConnection() {
        if (this.connectionString !== undefined && typeof(this.connectionString) === "string") {
            this.pool = new Pool({
                connectionString: this.connectionString,
            });
        } else if (this.config !== undefined && typeof(this.config) === "object") {
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
    
                user: this.config.user,
                password: this.config.password,
    
                min: this.config.minConnections ?? 10,
                max: this.config.maxConnections ?? 20,
            });
        }
    }

    private constructor(connectionString: string);
    private constructor(str: undefined, config: IDatabaseConfig);
    private constructor(
        private readonly connectionString?: string,
        private readonly config?: IDatabaseConfig,
    ) {
        this.setupPooledConnection();
    }

    public static async fromConfigFile(configFileLocation: string): Promise<DatabaseConnection> {
        if (!existsSync(configFileLocation)) {
            throw new Error(`File not found: ${configFileLocation}`);
        }

        const configuration: IDatabaseConfig = JSON.parse(
            await readFile(configFileLocation, { encoding: "utf-8" })
        );

        return new DatabaseConnection(undefined, configuration);
    }

    public static async fromConfig(configuration: IDatabaseConfig): Promise<DatabaseConnection> {
        return new DatabaseConnection(undefined, configuration);
    }

    public static async fromConnectionString(connectionString: string): Promise<DatabaseConnection> {
        return new DatabaseConnection(connectionString);
    }

    public async beginTransaction(workingSchema: string = "public"): Promise<TransactionContext> {
        const cli = await this.pool?.connect();

        if (!cli) {
            throw new Error("Unable to acquire a new connection client");
        }

        const transaction = new TransactionContext(this, cli, workingSchema);

        await transaction.waitForReady();

        return transaction;
    }

    public async escapeIdentifier(identifier: string) {
        const cli = await this.pool?.connect();
        
        if (!cli) {
            throw new Error("Unable to acquire a new connection client");
        }

        return cli.escapeIdentifier(identifier);
    }

    public async doQuery<TResult>(query: string, values?: any[]): Promise<QueryReturn<TResult> | null> {
        const cli = await this.pool?.connect();

        if (!cli) {
            throw new Error("Unable to acquire a new connection client");
        }

        try {
            const result = await cli?.query(
                query,
                values
            );
    
            if (!result) {
                throw new Error("Database query error");
            }

            return {
                rows: result.rows,
                count: result.rowCount ?? 0,
            };
        } catch (err) {
            console.log(err);
            return null;
        } finally {
            cli.release();
        }
    }

    public async close(): Promise<void> {
        await this.pool?.end();
    }
}
