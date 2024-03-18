import { IJobStep } from "./IJobStep.js";

export type BlockingConfig = {
    awaitInputFormatting: boolean;
    workInBackground: boolean;
    persistResultInBackground: boolean;
};

export interface IJobConfiguration {
    readonly jobId: string;
    readonly jobName: string;
    readonly jobTimeoutMs: number;

    readonly blockingConfig: BlockingConfig;

    addJobStep(step: IJobStep): Promise<boolean>;
    removeJobStep(step: IJobStep): Promise<boolean>;
    
    getJobSteps(): Promise<IJobStep[]>;
}
