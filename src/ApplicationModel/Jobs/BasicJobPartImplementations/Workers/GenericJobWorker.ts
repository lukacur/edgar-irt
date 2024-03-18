import { IJobConfiguration } from "../../IJobConfiguration.js";
import { IJobStep } from "../../IJobStep.js";
import { AbstractJobWorker } from "../../Workers/AbstractJobWorker.js";

export class GenericJobWorker extends AbstractJobWorker<object, object> {
    private executionResult: object | null = null;
    constructor(
        private readonly jobConfig: IJobConfiguration,
    ) {
        super();
    }

    protected override async executeStep(jobStep: IJobStep, stepInput: object | null): Promise<object | null> {
        return (this.executionResult = await jobStep.run(stepInput));
    }

    protected override async getExecutionResultTyped(): Promise<object | null> {
        return this.executionResult;
    }
}
