import { IItem } from "../../IRT/Item/IItem.js";
import { IRTService } from "../../IRTService.js";
import { AbstractIRTDriver } from "../Driver/AbstractIRTDriver.js";
import { IParameterGenerator } from "../ParameterGeneration/IParameterGenerator.js";
import { AbstractStatisticsProcessor } from "../StatisticsProcessor/AbstractStatisticsProcessor.js";
import { RunnerException } from "./RunnerException.js";
import { RunnerNotConfiguredException } from "./RunnerNotConfiguredException.js";

export class MasterRunner {
    public static readonly instance = new MasterRunner();

    private constructor() {}


    private running: boolean = false;
    private runningPromise: Promise<void> | null = null;

    private runningDriver: AbstractIRTDriver<IItem> | null = null;
    private statisticsProcessor: AbstractStatisticsProcessor | null = null;
    private parameterGenerator: IParameterGenerator | null = null;

    public registerDriver<TItem extends IItem>(irtDriver: AbstractIRTDriver<TItem>): void {
        this.runningDriver = irtDriver;
    }

    public registerStatisticsProcessor(statProc: AbstractStatisticsProcessor): void {
        this.statisticsProcessor = statProc;
    }

    public registerParameterGenerator(paramGenerator: IParameterGenerator): void {
        this.parameterGenerator = paramGenerator;
    }

    private configurationValid(): boolean {
        return this.runningDriver !== null && this.statisticsProcessor !== null && this.parameterGenerator !== null;
    }

    private async begin(): Promise<void> {
        while (this.running && this.configurationValid()) {
            const batch = await this.runningDriver!.createBatch();
            const batchStatsProcessor = this.statisticsProcessor!.createNew(batch);
            const batchCalculationResult =
                await this.parameterGenerator!.generateParameters(batchStatsProcessor, batch);

            let resultPosted = false;
            while (!resultPosted && this.running) {
                resultPosted = await this.runningDriver!.postResult(batchCalculationResult);
            }
        }
    }

    public start(ctrlToken?: string): void {
        if (!IRTService.isValidControlToken(ctrlToken)) {
            throw new RunnerException("Runner can only be started from a ConfiguredIRTService instance");
        }

        if (!this.configurationValid()) {
            throw new RunnerNotConfiguredException("No driver was registered for this runner");
        }

        this.running = true;
        this.runningPromise = this.begin();
    }

    public async stop(ctrlToken?: string): Promise<void> {
        if (!IRTService.isValidControlToken(ctrlToken)) {
            throw new RunnerException("Runner can only be stopped from a ConfiguredIRTService instance");
        }

        if (!this.running || this.runningPromise === null) {
            return;
        }

        this.running = false;
        await this.runningPromise;
        this.runningPromise = null;
    }
}
