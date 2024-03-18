import { IJobConfiguration } from "../IJobConfiguration.js";

export interface IJobInputFormatter {
    formatJobInput(jobConfiguration: IJobConfiguration): Promise<object>;
    formatInput(input: object | null): Promise<object | null>;
}
