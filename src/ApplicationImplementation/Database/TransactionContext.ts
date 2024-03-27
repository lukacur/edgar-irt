import { DelayablePromise } from "../../Util/DelayablePromise.js";
import { DatabaseConnection, QueryReturn } from "./DatabaseConnection.js";
import * as pg from 'pg';

export class TransactionContext {
    private finished: boolean = false;

    private readyProm: Promise<boolean>;

    constructor(
        private readonly dbConn: DatabaseConnection,
        private readonly client: pg.PoolClient,
        private readonly workingSchema: string = "public",
    ) {
        const delProm = new DelayablePromise<boolean>();
        this.readyProm = delProm.getWrappedPromise();

        this.client.query(
            `BEGIN TRANSACTION;
            SET search_path TO ${this.client.escapeIdentifier(this.workingSchema)};`
        ).then((_) => delProm.delayedResolve(true));
    }

    public async waitForReady(): Promise<void> {
        await this.readyProm;
    }

    public isFinished(): boolean {
        return this.finished;
    }

    public async doQuery<TResult>(query: string, values?: any[]): Promise<QueryReturn<TResult> | null> {
        if (this.finished) {
            return null;
        }

        try {
            const result = await this.client?.query(
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
            await this.rollback();
        }

        return null;
    }

    public async commit(): Promise<DatabaseConnection> {
        if (this.finished) {
            return this.dbConn;
        }

        try {
            await this.client.query("COMMIT;");
        } catch (err) {
            console.log(err);
        } finally {
            await this.client.query("SET search_path TO public;");
            this.client.release();
        }

        this.finished = true;

        return this.dbConn;
    }

    public async rollback(): Promise<DatabaseConnection> {
        if (this.finished) {
            return this.dbConn;
        }

        try {
            await this.client.query("ROLLBACK;");
        } catch (err) {
            console.log(err);
        } finally {
            await this.client.query("SET search_path TO public;");
            this.client.release();
        }

        this.finished = true;

        return this.dbConn;
    }
}
