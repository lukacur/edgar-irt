import { IJobStep } from "../IJobStep.js";

export interface IJobWorker {
    executeStep(jobStep: IJobStep, stepInput: object | null): Promise<object | null>;
    getExecutionResult(): Promise<object | null>;
}
