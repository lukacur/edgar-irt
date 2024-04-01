import { IJobConfiguration } from "../IJobConfiguration.js";

export interface IJobProvider {
    provideJob(): Promise<IJobConfiguration>;

    extendJob(jobId: string, extendForMs: number): Promise<"success" | "fail" | "job-inactive">;

    finishJob(jobId: string): Promise<boolean>;

    /**
     * Note that this method returns a promise that resolves when the backing job retry logic is finished execution.
     * This promise SHOULD NOT BE AWAITED if you don't want to wait for that logic to finish.
     * 
     * IMPORTANT: if @param retryMode is set to retry after some time, the returned promise will resolve after that time
     * + the time needed for the backing job retry logic to finish execution.
     * @param jobId the ID of the job that should be failed
     * @param retryMode retry mode for the job
     */
    failJob(
        jobId: string,
        retryMode: "retry" | "no-retry" | { retryAfterMs: number },
        statusMessage?: string,
    ): Promise<boolean>;
}
