import { IJobInputFormatter } from "./ApplicationModel/Jobs/InputFormatters/IJobInputFormatter.js";
import { IJobProvider } from "./ApplicationModel/Jobs/Providers/IJobProvider.js";
import { IWorkResultPersistor } from "./ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { IJobWorker } from "./ApplicationModel/Jobs/Workers/IJobWorker.js";

export class JobRunner {
    constructor(
        private readonly jobProvider: IJobProvider,
        private readonly jobInputFormatter: IJobInputFormatter,
        private readonly jobWorker: IJobWorker,
        private readonly jobWorkResultPersistor: IWorkResultPersistor,
    ) {}

    private stopped: boolean = false;
    private runningPromise: Promise<void> | null = null;

    private async run(): Promise<void> {
        while (!this.stopped) {
            const jobConfig = await this.jobProvider.provideJob();

            try {
                const jobInput = await this.jobInputFormatter.formatJobInput(jobConfig);
            
                let success = await this.jobWorker.startExecution(jobConfig, jobInput);
                if (!success) {
                    await this.jobProvider.failJob(jobConfig.jobId);
                    continue;
                }

                while (this.jobWorker.hasNextStep()) {
                    if (!(await this.jobWorker.executeNextStep())) {
                        success = false;
                        break;
                    }
                }

                if (!success) {
                    await this.jobProvider.failJob(jobConfig.jobId);
                    continue;
                }

                const result = await this.jobWorker.getExecutionResult();

                if (!(await this.jobWorkResultPersistor.perisistResult(result, jobConfig))) {
                    await this.jobProvider.failJob(jobConfig.jobId);
                    continue;
                }

                await this.jobProvider.finishJob(jobConfig.jobId);
            } catch (err) {
                console.log(err);

                await this.jobProvider.failJob(jobConfig.jobId);
            }
        }
        
        this.runningPromise = null;
        return;
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
