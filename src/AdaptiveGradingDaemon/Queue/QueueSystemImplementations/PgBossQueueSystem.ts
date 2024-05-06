import PgBoss from "pg-boss";
import { IQueueSystemBase } from "../IQueueSystemBase.js";
import { DelayablePromise } from "../../../Util/DelayablePromise.js";
import { IDatabaseConfig } from "../../../ApplicationImplementation/Models/Config/DatabaseConfig.model.js";
import { QueueClosedException } from "../../Exceptions/QueueClosedException.js";

// In the database that this class uses command 'CREATE EXTENSION pgcrypto;' must be ran before using PgBoss
export class PgBossQueueSystem<TQueueData extends object> implements IQueueSystemBase<TQueueData> {
    private bossCon: PgBoss | null = null;

    private startProm: Promise<PgBoss> | null = null;

    constructor(
        public readonly queueName: string,
        private readonly pgBossConnStringOrConfig: string | IDatabaseConfig,
    ) {
        if (typeof(this.pgBossConnStringOrConfig) === "string") {
            this.bossCon = new PgBoss(this.pgBossConnStringOrConfig);
        } else {
            this.bossCon = new PgBoss({
                host: this.pgBossConnStringOrConfig.host,
                port: this.pgBossConnStringOrConfig.port,
                database: this.pgBossConnStringOrConfig.database,

                user: this.pgBossConnStringOrConfig.user,
                password: this.pgBossConnStringOrConfig.password,
                schema: this.pgBossConnStringOrConfig.schema,
                //max: this.pgBossConnStringOrConfig.maxConnections,
                newJobCheckInterval: 20000,
            });
        }
        this.startProm = this.bossCon.start().then(b => { this.startProm = null; return this.bossCon = b; });
    }

    public async enqueue(data: TQueueData): Promise<boolean> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        if (this.bossCon === null) {
            throw new Error("PgBoss connection was not correctly setup or was unable to be set up");
        }

        const jobId = await this.bossCon.send(this.queueName, data);

        return jobId !== null
    }

    private readonly dequeueRequests: DelayablePromise<TQueueData>[] = [];
    public async dequeue(): Promise<TQueueData> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        if (this.bossCon === null) {
            throw new Error("PgBoss connection was not correctly setup or was unable to be set up");
        }

        const delProm = new DelayablePromise<TQueueData>();
        this.dequeueRequests.push(delProm);

        const workId = await this.bossCon.work<TQueueData>(
            this.queueName,
            { newJobCheckInterval: 1000 },
            async (job) => {
                await this.bossCon?.offWork({ id: workId });
                await delProm.delayedResolve(job.data);
                
                const idx = this.dequeueRequests.indexOf(delProm);
                if (idx !== -1) {
                    this.dequeueRequests.splice(idx, 1);
                }
            }
        );
        
        return await delProm.getWrappedPromise();
    }

    public async peek(): Promise<TQueueData | null> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        if (this.bossCon === null) {
            throw new Error("PgBoss connection was not correctly setup or was unable to be set up");
        }

        if ((await this.bossCon.getQueueSize(this.queueName)) === 0) {
            return null;
        }

        const delProm = new DelayablePromise<TQueueData>();
        
        const workId = await this.bossCon.work<TQueueData>(
            this.queueName,
            async (job) => {
                await this.bossCon?.offWork({ id: workId });
                await delProm.delayedResolve(job.data);
            }
        );

        const peeked = await delProm.getWrappedPromise();

        await this.bossCon.send(this.queueName, peeked, { priority: 99999999 });

        return peeked;
    }


    public async empty(): Promise<boolean> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        if (this.bossCon === null) {
            throw new Error("PgBoss connection was not correctly setup or was unable to be set up");
        }

        await this.bossCon.deleteQueue(this.queueName);

        return true;
    }


    public async close(): Promise<void> {
        if (this.bossCon === null) {
            throw new Error("PgBoss connection was not correctly setup or was unable to be set up");
        }

        for (const deqReq of this.dequeueRequests) {
            deqReq.delayedReject(new QueueClosedException("The queue was closed"));
        }

        await this.bossCon.stop({ destroy: true, graceful: true });
    }
}
