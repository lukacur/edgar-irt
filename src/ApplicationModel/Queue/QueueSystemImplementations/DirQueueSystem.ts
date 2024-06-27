import { Dirent, existsSync, lstatSync } from "fs";
import { DelayablePromise } from "../../../Util/DelayablePromise.js";
import { AsyncMutex } from "../../Mutex/AsyncMutex.js";
import { IQueueSystemBase } from "../IQueueSystemBase.js";
import path from "path";
import { readFile, readdir, unlink, writeFile } from "fs/promises";
import { QueueClosedException } from "../../../Exceptions/QueueClosedException.js";

export class DirQueueSystem<TQueueData> implements IQueueSystemBase<TQueueData> {
    private readonly dequeueRequests: DelayablePromise<TQueueData>[] = [];
    private readonly operationMutex = new AsyncMutex();

    private fileNameConflictResolve: number = 1;

    constructor(
        public readonly queueName: string,
        private readonly location: string,
        private readonly fileNamingScheme: { prefix: string, name: string, suffixProvider: () => string },
    ) {
        if (!lstatSync(location).isDirectory()) {
            throw new Error("Given location is not a directory");
        }
    }

    private getFileName(): string {
        return this.fileNamingScheme.prefix + this.fileNamingScheme.name + this.fileNamingScheme.suffixProvider();
    }

    private async getDirFiles(): Promise<Dirent[]> {
        return (await readdir(
            this.location,
            { encoding: "utf-8", recursive: false, withFileTypes: true }
        ))
        .filter(f => f.isFile())
        .sort(
            (f1, f2) =>
                lstatSync(path.join(this.location, f1.name)).birthtimeMs -
                    lstatSync(path.join(this.location, f2.name)).birthtimeMs
        );
    }

    public async enqueue(data: TQueueData): Promise<boolean> {
        const monitorKey = await this.operationMutex.lock();

        try {
            if (this.dequeueRequests.length !== 0) {
                this.dequeueRequests.shift()?.delayedResolve(data);
                return true;
            }
            
            let newFileName = path.join(this.location, this.getFileName());
            while (existsSync(newFileName + ".json")) {
                this.fileNameConflictResolve = (++this.fileNameConflictResolve) % 100 + 1;

                newFileName = newFileName.replace(/(_\d)*$/, `_${this.fileNameConflictResolve}`)
            }

            await writeFile(
                newFileName + ".json",
                JSON.stringify(data),
                { encoding: "utf-8", flag: "w" }
            );

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

            const dirContents = await this.getDirFiles();

            const data: TQueueData = JSON.parse(
                await readFile(
                    path.join(this.location, dirContents[0].name),
                    { encoding: "utf-8", flag: "r" }
                )
            );

            await unlink(path.join(this.location, dirContents[0].name));

            return data;
        } finally {
            await this.operationMutex.unlock(monitorKey);
        }
    }

    public async peek(): Promise<TQueueData | null> {
        try {
            const dirContents = await this.getDirFiles();
            if (dirContents.length === 0) {
                return null;
            }

            return JSON.parse(
                await readFile(
                    path.join(this.location, dirContents[0].name),
                    { encoding: "utf-8", flag: "r" }
                )
            );
        } catch (err) {
            console.log(err);
        }

        return null;
    }


    public async empty(): Promise<boolean> {
        const monitorKey = await this.operationMutex.lock();

        try {
            await Promise.all(
                (await this.getDirFiles())
                    .map(df => unlink(path.join(this.location, df.name)))
            );

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
