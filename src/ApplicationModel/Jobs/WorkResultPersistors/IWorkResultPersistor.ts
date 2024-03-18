import { IJobConfiguration } from "../IJobConfiguration.js";

export interface IWorkResultPersistor {
    perisistResult(jobResult: object, jobConfig: IJobConfiguration): Promise<boolean>;
}
