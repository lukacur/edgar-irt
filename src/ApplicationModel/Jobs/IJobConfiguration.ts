import { IJobStep } from "./IJobStep.js";

export interface IJobConfiguration {
    readonly jobId: string;
    readonly jobName: string;
    readonly jobTimeoutMs: number;

    addJobStep(step: IJobStep): Promise<boolean>;
    removeJobStep(step: IJobStep): Promise<boolean>;
    
    getJobSteps(): Promise<IJobStep[]>;
}
