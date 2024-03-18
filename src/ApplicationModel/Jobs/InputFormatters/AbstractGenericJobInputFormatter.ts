import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobInputFormatter } from "./IJobInputFormatter.js";

export abstract class AbstractGenericJobInputFormatter<
    TJobConfiguration extends IJobConfiguration,
    TFormattingInput extends object,
    TJobInput extends object,
> implements IJobInputFormatter {
    protected abstract formatJobInputTyped(jobConfiguration: TJobConfiguration): Promise<TJobInput>;

    public async formatJobInput(jobConfiguration: IJobConfiguration): Promise<object> {
        return await this.formatJobInputTyped(jobConfiguration as TJobConfiguration);
    }

    protected abstract formatInputTyped(input: TFormattingInput | null): Promise<TJobInput | null>;

    public async formatInput(input: object | null): Promise<object | null> {
        return await this.formatInputTyped(input as TFormattingInput);
    }
}
