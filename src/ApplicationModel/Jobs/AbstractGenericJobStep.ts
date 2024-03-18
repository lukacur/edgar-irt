import { IJobStep } from "./IJobStep.js";

export abstract class AbstractGenericJobStep<
    TStepConfiguration extends object,
    TStepInput extends object,
    TRunResult extends object,
> implements IJobStep {
    constructor(
        public readonly stepTimeoutMs: number,
        public readonly stepConfiguration: TStepConfiguration,
    ) {}

    protected abstract runTyped(stepInput: TStepInput | null): Promise<TRunResult | null>;

    public async run(stepInput: object | null): Promise<object | null> {
        return await this.runTyped(stepInput as TStepInput);
    }
}
