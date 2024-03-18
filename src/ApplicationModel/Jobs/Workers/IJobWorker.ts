import { IJobConfiguration } from "../IJobConfiguration.js";

export interface IJobWorker {
    startExecution(jobConfiguration: IJobConfiguration, initialInput: object | null): Promise<boolean>;
    hasNextStep(): boolean;
    executeNextStep(): Promise<boolean>;
    getExecutionResult(): Promise<object | null>;
}
