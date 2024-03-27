import { IJobConfiguration } from "../IJobConfiguration.js";
import { IInputDataExtractor } from "./IInputDataExtractor.js";

export abstract class AbstractGenericInputDataExtractor<
    TJobConfiguration extends IJobConfiguration,
    TJobInput extends object,
> implements IInputDataExtractor {
    protected abstract formatJobInputTyped(jobConfiguration: TJobConfiguration): Promise<TJobInput>;

    public async formatJobInput(jobConfiguration: IJobConfiguration): Promise<object> {
        return await this.formatJobInputTyped(jobConfiguration as TJobConfiguration);
    }
}
