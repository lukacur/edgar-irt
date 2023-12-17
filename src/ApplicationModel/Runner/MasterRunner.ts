import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractIRTDriver } from "../Driver/AbstractIRTDriver.js";
import { AbstractStatisticsProcessor } from "../StatisticsProcessor/AbstractStatisticsProcessor.js";
import { RunnerNotConfiguredException } from "./RunnerNotConfiguredException.js";

export class MasterRunner {
    public static readonly instance = new MasterRunner();

    private constructor() {}


    private running: boolean = false;
    private runningPromise: Promise<void> | null = null;

    private runningDriver: AbstractIRTDriver<IItem> | null = null;
    private statisticsProcessor: AbstractStatisticsProcessor | null = null;

    public registerDriver<TItem extends IItem>(irtDriver: AbstractIRTDriver<TItem>): void {
        this.runningDriver = irtDriver;
    }

    public registerStatisticsProcessor(statProc: AbstractStatisticsProcessor): void {
        this.statisticsProcessor = statProc;
    }

    private async begin(): Promise<void> {
        while (this.running && this.runningDriver !== null) {
            const batch = await this.runningDriver.createBatch();
            const batchStatsProcessor = this.statisticsProcessor?.createNew(batch);
            /** TODO: process the batch... */

            let resultPosted = false;
            while (!resultPosted) {
                resultPosted = await this.runningDriver.postResult();
            }
        }
    }

    public start(): void {
        if (this.runningDriver === null) {
            throw new RunnerNotConfiguredException("No driver was registered for this runner");
        }

        this.running = true;
        this.runningPromise = this.begin();
    }

    public async stop(): Promise<void> {
        if (!this.running || this.runningPromise === null) {
            return;
        }

        this.running = false;
        await this.runningPromise;
        this.runningPromise = null;
    }
}
