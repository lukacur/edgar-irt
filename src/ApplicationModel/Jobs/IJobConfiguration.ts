import { IJobStep } from "./IJobStep.js";

export type BlockingConfig = {
    awaitDataExtraction: boolean;
    workInBackground: boolean;
    persistResultInBackground: boolean;
};

export type InputExtractorConfig<TConfigContent extends object> = {
    type: string;
    configContent: TConfigContent;
};

export type JobStepDescriptor = {
    type: string;
    stepTimeoutMs: number;
    resultTTL?: number;
    configContent: object;
};

export type JobWorkerConfig = {
    type: string;
    databaseConnection: string;
    steps: JobStepDescriptor[];
};

export type DataPersistorConfig<TConfigContent extends object> = {
    type: string;
    persistanceTimeoutMs: number;
    configContent: TConfigContent;
};

export interface IJobConfiguration/* <TInputExtractorConfig, TDataPersistorConfig> */ {
    readonly jobId: string;
    readonly jobName: string;
    readonly idUserStarted: number | null;
    readonly jobQueue: string | null;
    readonly jobTimeoutMs: number;

    readonly blockingConfig: BlockingConfig;

    readonly inputExtractorConfig: InputExtractorConfig<object>;

    readonly jobWorkerConfig: JobWorkerConfig;

    readonly dataPersistorConfig: DataPersistorConfig<object>;

    addJobStep?(step: IJobStep): Promise<boolean>;
    removeJobStep?(step: IJobStep): Promise<boolean>;
    
    getJobSteps?(): Promise<IJobStep[]>;

    getRawDescriptor?(): Promise<string | null>;
}
