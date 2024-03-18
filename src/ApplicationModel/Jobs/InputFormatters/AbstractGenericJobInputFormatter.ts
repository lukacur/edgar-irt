import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobInputFormatter } from "./IJobInputFormatter.js";

export abstract class AbstractGenericJobInputFormatter<
    TJobConfiguration extends IJobConfiguration,
    TJobInput extends object
> implements IJobInputFormatter {
    protected abstract formatJobInputTyped(jobConfiguration: TJobConfiguration): Promise<TJobInput>;

    public async formatJobInput(jobConfiguration: IJobConfiguration): Promise<object> {
        return await this.formatJobInputTyped(jobConfiguration as TJobConfiguration);
    }
}
