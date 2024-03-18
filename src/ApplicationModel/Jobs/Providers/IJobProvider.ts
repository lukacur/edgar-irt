import { IJobConfiguration } from "../IJobConfiguration.js";

export interface IJobProvider {
    provideJob(): Promise<IJobConfiguration>;

    extendJob(extendForMs: number): Promise<"success" | "fail" | "job-inactive">;

    finishJob(jobId: string): Promise<boolean>;
}
