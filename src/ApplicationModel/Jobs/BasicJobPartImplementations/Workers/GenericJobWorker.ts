import { IJobConfiguration } from "../../IJobConfiguration.js";
import { IJobStep, StepResult } from "../../IJobStep.js";
import { AbstractJobWorker } from "../../Workers/AbstractJobWorker.js";

export class GenericJobWorker extends AbstractJobWorker<object, object> {
    private executionResult: StepResult<object> | null = null;
    private wasResultCritical: boolean = false;

    constructor(
        private readonly jobConfig: IJobConfiguration,
    ) {
        super();
    }

    protected override initStepsToDB(jobConfig: IJobConfiguration): Promise<void> {
        throw new Error("Not implemented");
    }

    protected override startStepDB(jobStep: IJobStep): Promise<void> {
        throw new Error("Not implemented");
    }
    
    protected override saveJobStepResultToDB(jobStep: IJobStep, stepResult: StepResult<object> | null): Promise<void> {
        throw new Error("Not implemented");
    }

    protected override async executeStep(
        jobStep: IJobStep,
        stepInput: (object | null)[]
    ): Promise<StepResult<object> | null> {
        return (this.executionResult = await jobStep.run(stepInput));
    }

    protected override async getExecutionResultTyped(): Promise<StepResult<object> | null> {
        return this.executionResult === null ?
        {
            status: "failure",
            reason: "No result present",
            result: null,
            isCritical: this.wasResultCritical,
        } : this.executionResult;
    }
}
