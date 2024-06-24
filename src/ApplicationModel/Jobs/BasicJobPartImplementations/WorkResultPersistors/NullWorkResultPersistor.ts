import { IJobConfiguration } from "../../IJobConfiguration.js";
import { AbstractTypedWorkResultPersistor } from "../../WorkResultPersistors/AbstractTypedWorkResultPersistor.js";

export class NullWorkResultPersistor extends AbstractTypedWorkResultPersistor<object, IJobConfiguration> {
    protected async persistResultTyped(jobResult: object | null, jobConfig: IJobConfiguration): Promise<boolean> {
        return true;
    }
}
