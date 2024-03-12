import PgBoss from "pg-boss";
import { IQueueSystemBase } from "../IQueueSystemBase.js";
import { DelayablePromise } from "../../../Util/DelayablePromise.js";

export class PgBossQueueSystem<TQueueData extends object> implements IQueueSystemBase<TQueueData> {
    private readonly bossCon: PgBoss;

    private startProm: Promise<PgBoss> | null = null;

    constructor(
        private readonly pgBossConnString: string,
        private readonly queueName: string,
    ) {
        this.bossCon = new PgBoss(this.pgBossConnString);
        this.startProm = this.bossCon.start().then(b => { this.startProm = null; return b; });
    }

    public async enqueue(data: TQueueData): Promise<boolean> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        const jobId = await this.bossCon.send(this.queueName, data);

        return jobId !== null
    }

    public async dequeue(): Promise<TQueueData> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        const delProm = new DelayablePromise<TQueueData>();

        await this.bossCon.work<TQueueData>(
            this.queueName,
            async (job) => {
                await delProm.delayedResolve(job.data);
            }
        );
        
        return await delProm.getWrappedPromise();
    }

    public async peek(): Promise<TQueueData | null> {
        return null;
    }


    public async empty(): Promise<boolean> {
        if (this.startProm !== null) {
            await this.startProm;
        }

        await this.bossCon.deleteQueue(this.queueName);

        return true;
    }


    public async close(): Promise<void> {
        await this.bossCon.stop({ destroy: true, graceful: true });
    }
}
