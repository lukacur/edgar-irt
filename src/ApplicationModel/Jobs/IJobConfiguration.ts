import { IJobStep } from "./IJobStep.js";

export interface IJobConfiguration {
    jobId: string;
    jobName: string;
    jobTimeoutMs: number;

    jobSteps: IJobStep[];
}
