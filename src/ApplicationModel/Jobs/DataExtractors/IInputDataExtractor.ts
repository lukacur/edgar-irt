import { IJobConfiguration } from "../IJobConfiguration.js";

// FIXME: IInputDataExtractor ili IInputDataFormer
export interface IInputDataExtractor {
    formatJobInput(jobConfiguration: IJobConfiguration): Promise<object>;
}
