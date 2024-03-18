import { IJobStep } from "./IJobStep.js";

export abstract class AbstractGenericJobStep<TStepConfiguration extends object> implements IJobStep {
    constructor(
        public readonly stepTimeoutMs: number,
        public readonly stepConfiguration: TStepConfiguration,
    ) {}
}
