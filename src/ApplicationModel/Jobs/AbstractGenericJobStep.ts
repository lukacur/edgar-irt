import { IJobStep, StepResult } from "./IJobStep.js";

export abstract class AbstractGenericJobStep<
    TStepConfiguration extends object,
    TStepInput extends object,
    TRunResult extends object,
> implements IJobStep {
    constructor(
        public readonly stepTimeoutMs: number,
        public readonly stepConfiguration: TStepConfiguration,
    ) {}

    protected abstract runTyped(stepInput: TStepInput | null): Promise<StepResult<TRunResult>>;

    public async run(stepInput: object | null): Promise<StepResult<object>> {
        return await this.runTyped(stepInput as TStepInput);
    }
}
