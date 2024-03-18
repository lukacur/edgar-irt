import { BlockingConfig, IJobConfiguration } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { IJobStep } from "../../../../../ApplicationModel/Jobs/IJobStep.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";

export class EdgarStatProcJobConfiguration implements IJobConfiguration {
    private readonly jobSteps: IJobStep[] = [];

    constructor(
        public readonly jobId: string,
        public readonly jobName: string,
        public readonly jobTimeoutMs: number,

        public readonly courseBasedBatch: CourseBasedBatch,

        public readonly blockingConfig: BlockingConfig,
    ) {}

    public async addJobStep(step: IJobStep): Promise<boolean> {
        if (this.jobSteps.includes(step)) {
            return false;
        }
        
        this.jobSteps.push(step);

        return true;
    }

    public async removeJobStep(step: IJobStep): Promise<boolean> {
        const idx = this.jobSteps.indexOf(step);

        if (idx === -1) {
            return false;
        }

        this.jobSteps.splice(idx, 1);

        return true;
    }
    
    public async getJobSteps(): Promise<IJobStep[]> {
        return this.jobSteps;
    }
}
