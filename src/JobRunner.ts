import { IInputDataExtractor } from "./ApplicationModel/Jobs/DataExtractors/IInputDataExtractor.js";
import { IJobProvider } from "./ApplicationModel/Jobs/Providers/IJobProvider.js";
import { IWorkResultPersistor } from "./ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { IJobWorker } from "./ApplicationModel/Jobs/Workers/IJobWorker.js";
import { JobPartsParser } from "./Util/JobPartsParser.js";

import { MailerProvider } from "./Util/MailerProvider.js";

type ErrorReport = { jobId: string, stage: string, message: string, status: string }

export class JobRunner {
    constructor(
        private readonly jobProvider: IJobProvider,
        private readonly dataExtractor?: IInputDataExtractor,
        private readonly jobWorker?: IJobWorker,
        private readonly jobWorkResultPersistor?: IWorkResultPersistor,
    ) {}

    private stopped: boolean = false;
    private runningPromise: Promise<void> | null = null;

    private errorMessageAdditionalInfoProvider(methodName: "runStrict" | "runGeneric"): string {
        return `
        More information:
          Method: ${methodName}
          JobRunner: ${this.constructor.name}
          Local time: ${new Date().toISOString()}
          Provider: ${this.jobProvider.constructor.name}
          Data extractor: ${this.dataExtractor?.constructor.name}
          Worker: ${this.jobWorker?.constructor.name}
          Persistor: ${this.jobWorkResultPersistor?.constructor.name}
        
        This runner was configured through code.
        `;
    }

    private async sendErrorReportMessage(errorReport: ErrorReport): Promise<void> {
        await MailerProvider.instance.getMailer().sendMail(
            {
                header: {
                    subject: "Job automatization - job failure",
                    from: undefined!,
                    to: undefined!,
                },
                body: {
                    type: "plain",
                    content: `This email is sent in order to inform you that a job with id '${errorReport.jobId}' ` +
                                `failed on pipeline stage '${errorReport.stage}' with status '${errorReport.status}'.` +
                                `
Failure message:
${errorReport.message.split('\n').join('\n    ')}`,
                }
            },
            true
        );
    }

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
        

        let errorReport: ErrorReport | null = null;
        while (!this.stopped) {
            if (errorReport !== null) {
                this.sendErrorReportMessage(errorReport);
                errorReport = null;
            }
            const jobConfig = await this.jobProvider.provideJob();

            try {
                const jobInput = await this.dataExtractor.formatJobInput(jobConfig);

                let currWorker = this.jobWorker;
            
                let success = await currWorker.startExecution(jobConfig, jobInput);
                if (!success) {
                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Worker initial step",
                        message: "",
                        status: "General failure"
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        "retry",
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: unable to run initial job step " +
                                "(IJobWorker.startExecution() returned 'false')" +
                                this.errorMessageAdditionalInfoProvider("runStrict")
                    );
                    continue;
                }

                while (currWorker.hasNextStep()) {
                    if (!(await currWorker.executeNextStep())) {
                        success = false;
                        break;
                    }
                }

                if (!success) {
                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Worker job step execution",
                        message: "",
                        status: "General failure"
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        "retry",
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: job was implicitly failed by a job step " +
                                "(IJobWorker.executeNextStep() returned 'false' when 'true' was expected)" +
                                this.errorMessageAdditionalInfoProvider("runStrict")
                    );
                    continue;
                }

                const result = await currWorker.getExecutionResult();
                if (result?.status !== "success") {
                    const status = result?.status;

                    console.log(
                        `Job execution failed with status ${status}. Reason: ${result?.reason ?? "unknown reason"}`
                    );

                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Worker explicit step",
                        message: "",
                        status: status!
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        (status === "failure") ? "retry" : "no-retry",
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: job was explicitly failed by a job step " +
                                "(IJobWorker.getExecutionResult() return value had status !== 'success')" +
                                `
                                Failure reason: ${result?.reason ?? "Unspecified reason"}` +
                                this.errorMessageAdditionalInfoProvider("runStrict")
                    );
                    continue;
                }

                if (!(await this.jobWorkResultPersistor.perisistResult(result.result, jobConfig))) {
                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Result persistance step",
                        message: "",
                        status: "General failure"
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        { retryAfterMs: 15000 },
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: persistance of the result was " +
                                "unsuccessful (IJobWorker.perisistResult() returned 'false')" +
                                this.errorMessageAdditionalInfoProvider("runStrict")
                    );
                    continue;
                }

                await this.jobProvider.finishJob(jobConfig.jobId);

                console.log(`Job execution finished successfully for job with ID ${jobConfig.jobId}`);
            } catch (err) {
                console.log(err);

                let errorName: string = "Unknown error";
                let errorMessage: string | null = null;
                let stackTrace: string | null = null;
                if (err instanceof Error) {
                    errorName = err.name;
                    errorMessage = err.message;
                    stackTrace = err.stack ?? null;
                }

                errorReport ??= {
                    jobId: jobConfig.jobId,
                    stage: "Job execution - general",
                    message: "",
                    status: "Job fatal failure"
                };

                await this.jobProvider.failJob(
                    jobConfig.jobId,
                    { retryAfterMs: 20000 },
                    errorReport.message =
                        `[JobRunner.ts] Error occured when running job: exception of type ${errorName} was thrown` +
                            `
                            Error message:
                            ${errorMessage}

                            Stack trace:
                            ${stackTrace}
                            ` +
                            this.errorMessageAdditionalInfoProvider("runStrict")
                );
            }
        }
    }
    
    private async runGeneric(): Promise<void> {
        let errorReport: ErrorReport | null = null;
        while (!this.stopped) {
            if (errorReport !== null) {
                this.sendErrorReportMessage(errorReport);
                errorReport = null;
            }

            const jobConfig = await this.jobProvider.provideJob();

            try {
                const parser = JobPartsParser.with(jobConfig);

                const inputExtractor = await parser.getInputDataExtractor();
                const jobWorker = await parser.getJobWorker();
                const persistor = await parser.getResultPersistor();

                // TODO: Maybe 'formatInitialJobInput(jobConfig)'?
                const jobInput = await inputExtractor.formatJobInput(jobConfig);
            
                let success = await jobWorker.startExecution(jobConfig, jobInput);
                if (!success) {
                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Worker initial step",
                        message: "",
                        status: "General failure"
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        "retry",
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: unable to run initial job step " +
                                "(IJobWorker.startExecution() returned 'false')" +
                                this.errorMessageAdditionalInfoProvider("runGeneric")
                    );
                    continue;
                }

                while (jobWorker.hasNextStep()) {
                    if (!(await jobWorker.executeNextStep())) {
                        success = false;
                        break;
                    }
                }

                if (!success) {
                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Worker job step execution",
                        message: "",
                        status: "General failure"
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        "retry",
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: job was implicitly failed by a job step " +
                                "(IJobWorker.executeNextStep() returned 'false' when 'true' was expected)" +
                                this.errorMessageAdditionalInfoProvider("runGeneric")
                    );
                    continue;
                }

                const result = await jobWorker.getExecutionResult();
                if (result?.status !== "success") {
                    const status = result?.status;

                    console.log(
                        `Job execution failed with status ${status}. Reason: ${result?.reason ?? "unknown reason"}`
                    );

                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Worker explicit step",
                        message: "",
                        status: status!
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        (status === "failure") ? "retry" : "no-retry",
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: job was explicitly failed by a job step " +
                                "(IJobWorker.getExecutionResult() return value had status !== 'success')" +
                                `
                                Failure reason: ${result?.reason ?? "Unspecified reason"}` +
                                this.errorMessageAdditionalInfoProvider("runGeneric")
                    );
                    continue;
                }

                if (!(await persistor.perisistResult(result.result, jobConfig))) {
                    errorReport ??= {
                        jobId: jobConfig.jobId,
                        stage: "Result persistance step",
                        message: "",
                        status: "General failure"
                    };

                    await this.jobProvider.failJob(
                        jobConfig.jobId,
                        { retryAfterMs: 15000 },
                        errorReport.message =
                            "[JobRunner.ts] Error occured when running job: persistance of the result was " +
                            "unsuccessful (IJobWorker.perisistResult() returned 'false')" +
                                this.errorMessageAdditionalInfoProvider("runGeneric")
                    );
                    continue;
                }

                await this.jobProvider.finishJob(jobConfig.jobId);

                console.log(`Job execution finished successfully for job with ID ${jobConfig.jobId}`);
            } catch (err) {
                console.log(err);

                let errorName: string = "Unknown error";
                let errorMessage: string | null = null;
                let stackTrace: string | null = null;
                if (err instanceof Error) {
                    errorName = err.name;
                    errorMessage = err.message;
                    stackTrace = err.stack ?? null;
                }

                errorReport ??= {
                    jobId: jobConfig.jobId,
                    stage: "Job execution - general",
                    message: "",
                    status: "Job fatal failure"
                };

                await this.jobProvider.failJob(
                    jobConfig.jobId,
                    { retryAfterMs: 20000 },
                    errorReport.message =
                        `[JobRunner.ts] Error occured when running job: exception of type ${errorName} was thrown` +
                            `
                            Error message:
                            ${errorMessage}

                            Stack trace:
                            ${stackTrace}
                            ` +
                            this.errorMessageAdditionalInfoProvider("runGeneric")
                );
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
