import { IJobConfiguration } from "./IJobConfiguration.js";

export interface IJobRunRequestParser<TJobRequest extends object> {
    fromJobRequest(request: TJobRequest): Promise<IJobConfiguration>;
}
