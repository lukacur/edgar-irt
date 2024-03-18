import { IJobConfiguration } from "../IJobConfiguration.js";

export interface IWorkResultPersistor {
    perisistResult(jobResult: object | null, jobConfig: IJobConfiguration): Promise<boolean>;
}
