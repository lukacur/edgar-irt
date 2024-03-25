import { IJobConfiguration } from "../IJobConfiguration.js";
import { StepResult } from "../IJobStep.js";

export interface IJobWorker {
    startExecution(jobConfiguration: IJobConfiguration, initialInput: object | null): Promise<boolean>;
    hasNextStep(): boolean;
    executeNextStep(): Promise<boolean>;
    getExecutionResult(): Promise<StepResult<object> | null>;

    clone(): IJobWorker;
}
