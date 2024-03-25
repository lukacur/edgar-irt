import { IJobConfiguration } from "../IJobConfiguration.js";
import { IInputDataExtractor } from "./IInputDataExtractor.js";

export abstract class AbstractGenericInputDataExtractor<
    TJobConfiguration extends IJobConfiguration,
    TFormattingInput extends object,
    TJobInput extends object,
> implements IInputDataExtractor {
    protected abstract formatJobInputTyped(jobConfiguration: TJobConfiguration): Promise<TJobInput>;

    public async formatJobInput(jobConfiguration: IJobConfiguration): Promise<object> {
        return await this.formatJobInputTyped(jobConfiguration as TJobConfiguration);
    }

    protected abstract formatInputTyped(input: TFormattingInput | null): Promise<TJobInput | null>;

    public async formatInput(input: object | null): Promise<object | null> {
        return await this.formatInputTyped(input as TFormattingInput);
    }
}
