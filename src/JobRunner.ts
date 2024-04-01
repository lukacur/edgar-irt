import { IInputDataExtractor } from "./ApplicationModel/Jobs/DataExtractors/IInputDataExtractor.js";
import { IJobProvider } from "./ApplicationModel/Jobs/Providers/IJobProvider.js";
import { IWorkResultPersistor } from "./ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { IJobWorker } from "./ApplicationModel/Jobs/Workers/IJobWorker.js";
import { InputExtractorRegistry } from "./PluginSupport/Registries/Implementation/InputExtractorRegistry.js";
import { JobWorkerRegistry } from "./PluginSupport/Registries/Implementation/JobWorkerRegistry.js";
import { PersistorRegistry } from "./PluginSupport/Registries/Implementation/PersistorRegistry.js";

export class JobRunner {
    constructor(
        private readonly jobProvider: IJobProvider,
        private readonly dataExtractor?: IInputDataExtractor,
        private readonly jobWorker?: IJobWorker,
        private readonly jobWorkResultPersistor?: IWorkResultPersistor,
    ) {}

    private stopped: boolean = false;
    private runningPromise: Promise<void> | null = null;

    private async runStrict(): Promise<void> {
        if (
            this.dataExtractor === undefined ||
                this.jobWorker === undefined ||
                this.jobWorkResultPersistor === undefined
        ) {
            throw new Error(
                `Job runner not properly configured: Missing configuration for generic job running. Given config:
                    dataExtractor: ${this.dataExtractor === undefined ? undefined : JSON.stringify(this.dataExtractor)};
                    jobWorker: ${this.jobWorker === undefined ? undefined : JSON.stringify(this.jobWorker)};
                    persistor: ${
                        this.jobWorkResultPersistor === undefined ?
                            undefined :
                            JSON.stringify(this.jobWorkResultPersistor)
                    };`
            );
        }

        while (!this.stopped) {
            const jobConfig = await this.jobProvider.provideJob();

            try {
                const jobInput = await this.dataExtractor.formatJobInput(jobConfig);

                let currWorker = this.jobWorker;
            
                let success = await currWorker.startExecution(jobConfig, jobInput);
                if (!success) {
                    await this.jobProvider.failJob(jobConfig.jobId, "retry");
                    continue;
                }

                while (currWorker.hasNextStep()) {
                    if (!(await currWorker.executeNextStep())) {
                        success = false;
                        break;
                    }
                }

                if (!success) {
                    await this.jobProvider.failJob(jobConfig.jobId, "retry");
                    continue;
                }

                const result = await currWorker.getExecutionResult();
                if (result?.status !== "success") {
                    const status = result?.status;

                    console.log(
                        `Job execution failed with status ${status}. Reason: ${result?.reason ?? "unknown reason"}`
                    );

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        (status === "failure") ? "retry" : "no-retry"
                    );
                    continue;
                }

                if (!(await this.jobWorkResultPersistor.perisistResult(result.result, jobConfig))) {
                    await this.jobProvider.failJob(jobConfig.jobId, { retryAfterMs: 15000 });
                    continue;
                }

                await this.jobProvider.finishJob(jobConfig.jobId);

                console.log(`Job execution finished successfully for job with ID ${jobConfig.jobId}`);
            } catch (err) {
                console.log(err);

                await this.jobProvider.failJob(jobConfig.jobId, { retryAfterMs: 20000 });
            }
        }
    }
    
    private async runGeneric(): Promise<void> {
        while (!this.stopped) {
            const jobConfig = await this.jobProvider.provideJob();

            try {
                const inputExtractor = InputExtractorRegistry.instance.getItem(
                    jobConfig.inputExtractorConfig.type,
                    jobConfig.inputExtractorConfig,
                );

                const jobWorker = JobWorkerRegistry.instance.getItem(
                    jobConfig.jobWorkerConfig.type,
                    jobConfig.jobWorkerConfig,
                );

                const persistor = PersistorRegistry.instance.getItem(
                    jobConfig.dataPersistorConfig.type,
                    jobConfig.dataPersistorConfig,
                );

                const jobInput = await inputExtractor.formatJobInput(jobConfig);
            
                let success = await jobWorker.startExecution(jobConfig, jobInput);
                if (!success) {
                    await this.jobProvider.failJob(jobConfig.jobId, "retry");
                    continue;
                }

                while (jobWorker.hasNextStep()) {
                    if (!(await jobWorker.executeNextStep())) {
                        success = false;
                        break;
                    }
                }

                if (!success) {
                    await this.jobProvider.failJob(jobConfig.jobId, "retry");
                    continue;
                }

                const result = await jobWorker.getExecutionResult();
                if (result?.status !== "success") {
                    const status = result?.status;

                    console.log(
                        `Job execution failed with status ${status}. Reason: ${result?.reason ?? "unknown reason"}`
                    );

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        (status === "failure") ? "retry" : "no-retry",
                    );
                    continue;
                }

                if (!(await persistor.perisistResult(result.result, jobConfig))) {
                    await this.jobProvider.failJob(jobConfig.jobId, { retryAfterMs: 15000 });
                    continue;
                }

                await this.jobProvider.finishJob(jobConfig.jobId);

                console.log(`Job execution finished successfully for job with ID ${jobConfig.jobId}`);
            } catch (err) {
                console.log(err);

                await this.jobProvider.failJob(jobConfig.jobId, { retryAfterMs: 20000 });
            }
        }
    }

    private async run(): Promise<void> {
        const prom: Promise<void> = (
            this.dataExtractor === undefined ||
            this.jobWorker === undefined ||
            this.jobWorkResultPersistor === undefined
        ) ?
        this.runGeneric() :
        this.runStrict();

        return prom.then(() => { this.runningPromise = null; });
    }

    /**
     * Starts the runner and returns a promise that, when resolved, indicates that the runner was stopped
     * @returns A promise that, when resolved, indicates the runner is no longer running jobs
     */
    public start(): Promise<void> {
        this.stopped = false;
        return this.runningPromise = this.run();
    }

    public async stop(blockUntilStopped: boolean): Promise<void> {
        this.stopped = false;

        if (blockUntilStopped) {
            await this.runningPromise;
        }

        return;
    }
}
