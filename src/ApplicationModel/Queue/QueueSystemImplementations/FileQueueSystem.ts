import { readFile, writeFile } from "fs/promises";
import { IQueueSystemBase } from "../IQueueSystemBase.js";
import { existsSync, lstatSync } from "fs";
import { DelayablePromise } from "../../../Util/DelayablePromise.js";
import { AsyncMutex } from "../../Mutex/AsyncMutex.js";
import { QueueClosedException } from "../../../Exceptions/QueueClosedException.js";

export class FileQueueSystem<TQueueData> implements IQueueSystemBase<TQueueData> {
    private readonly dequeueRequests: DelayablePromise<TQueueData>[] = [];
    private readonly operationMutex = new AsyncMutex();

    constructor(
        public readonly queueName: string,
        private readonly location: string,
    ) {
        if (!lstatSync(location).isFile()) {
            throw new Error("Given location is not a file");
        }
    }

    private async readFileQueue(): Promise<TQueueData[]> {
        if (!existsSync(this.location)) {
            throw new Error("Queue file no longer exists");
        }

        const fileContents = await readFile(this.location, { encoding: "utf-8", flag: "r" });
        if (fileContents === null || fileContents.trim() === "" || fileContents === "") {
            return [];
        }

        return JSON.parse(fileContents);
    }

    private async saveQueueToFile(theQueue: TQueueData[]): Promise<void> {
        if (!existsSync(this.location)) {
            throw new Error("Queue file no longer exists");
        }

        await writeFile(this.location, JSON.stringify(theQueue), { encoding: "utf-8", flag: "w" });
    }

    public async enqueue(data: TQueueData): Promise<boolean> {
        const monitorKey = await this.operationMutex.lock();

        try {
            if (this.dequeueRequests.length !== 0) {
                this.dequeueRequests.shift()?.delayedResolve(data);
                return true;
            }

            const dtQueue: TQueueData[] = await this.readFileQueue();
            dtQueue.push(data);
    
            await this.saveQueueToFile(dtQueue);

            return true;
        } catch (err) {
            console.log(err);
        } finally {
            await this.operationMutex.unlock(monitorKey);
        }

        return false;
    }

    public async dequeue(): Promise<TQueueData> {
        const monitorKey = await this.operationMutex.lock();

        try {
            if ((await this.peek()) === null) {
                const prm = new DelayablePromise<TQueueData>();
                this.dequeueRequests.push(prm);
    
                return prm.getWrappedPromise();
            }
    
            const queue = await this.readFileQueue();
            const queueItem = queue.shift()!;
    
            await this.saveQueueToFile(queue);
    
            return queueItem;
        } finally {
            await this.operationMutex.unlock(monitorKey);
        }
    }

    public async peek(): Promise<TQueueData | null> {
        try {
            const queue = await this.readFileQueue();

            return (queue.length === 0) ? null : queue[0];
        } catch (err) {
            console.log(err);
        }

        return null;
    }


    public async empty(): Promise<boolean> {
        const monitorKey = await this.operationMutex.lock();

        try {
            await writeFile(this.location, JSON.stringify([]), { encoding: "utf-8", flag: "w" });
            return true;
        } catch (err) {
            console.log(err);
        } finally {
            await this.operationMutex.unlock(monitorKey);
        }

        return false;
    }


    public async close(): Promise<void> {
        for (const dp of this.dequeueRequests) {
            dp.delayedReject(new QueueClosedException("The queue was closed"));
        }
        this.dequeueRequests.splice(0, this.dequeueRequests.length);
    }
}
