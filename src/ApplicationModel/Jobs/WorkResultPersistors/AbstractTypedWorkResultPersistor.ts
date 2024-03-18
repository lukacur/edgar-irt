import { IJobConfiguration } from "../IJobConfiguration.js";
import { IWorkResultPersistor } from "./IWorkResultPersistor.js";

export abstract class AbstractTypedWorkResultPersistor<
    TJobResult extends object,
    TJobConfiguration extends IJobConfiguration,
> implements IWorkResultPersistor {
    protected abstract persistResultTyped(jobResult: TJobResult | null, jobConfig: TJobConfiguration): Promise<boolean>;

    public async perisistResult(jobResult: object | null, jobConfig: IJobConfiguration): Promise<boolean> {
        return await this.persistResultTyped(
            jobResult as TJobResult,
            jobConfig as TJobConfiguration,
        );
    }
}
