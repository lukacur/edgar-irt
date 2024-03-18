import { IJobConfiguration } from "../IJobConfiguration.js";
import { IJobProvider } from "./IJobProvider.js";

export abstract class AbstractGenericJobProvider<
    TJobConfiguration extends IJobConfiguration
> implements IJobProvider {
    protected abstract provideJobTyped(): Promise<TJobConfiguration>;

    public async provideJob(): Promise<IJobConfiguration> {
        return await this.provideJobTyped();
    }

    public abstract extendJob(jobId: string, extendForMs: number): Promise<"success" | "fail" | "job-inactive">;
    public abstract finishJob(jobId: string): Promise<boolean>;
}
