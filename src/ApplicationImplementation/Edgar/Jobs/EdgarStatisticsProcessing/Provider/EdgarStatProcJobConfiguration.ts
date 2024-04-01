import { BlockingConfig, DataPersistorConfig, IJobConfiguration, InputExtractorConfig, JobWorkerConfig } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { IJobStep } from "../../../../../ApplicationModel/Jobs/IJobStep.js";
import { JobPartsParser } from "../../../../../Util/JobPartsParser.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";

export class EdgarStatProcJobConfiguration implements IJobConfiguration {
    private readonly jobSteps: IJobStep[] = [];

    private rawDescriptor: string | null = null;

    constructor(
        public readonly jobId: string,
        public readonly jobName: string,
        public readonly idUserStarted: number | null,
        public readonly jobQueue: string | null,
        public readonly jobTimeoutMs: number,

        public readonly inputExtractorConfig: InputExtractorConfig<CourseBasedBatch>,

        public readonly jobWorkerConfig: JobWorkerConfig,

        public readonly dataPersistorConfig: DataPersistorConfig<any>,

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

    public async getRawDescriptor(): Promise<string | null> {
        // FIXME: This could be unsafe?
        return this.rawDescriptor ?? JSON.stringify(this);
    }

    public static async fromGenericJobConfig(
        config: IJobConfiguration,
        jobIdProvider?: (currJobId: string) => string,
        nameProvider?: (currentName: string) => string
    ): Promise<EdgarStatProcJobConfiguration> {
        const instance = new EdgarStatProcJobConfiguration(
            (jobIdProvider !== undefined) ? jobIdProvider(config.jobId) : config.jobId,
            (nameProvider !== undefined) ? nameProvider(config.jobName) : config.jobName,
            config.idUserStarted,
            config.jobQueue,
            config.jobTimeoutMs,
            <InputExtractorConfig<CourseBasedBatch>>config.inputExtractorConfig,
            config.jobWorkerConfig,
            config.dataPersistorConfig,
            config.blockingConfig,
        );
        
        instance.rawDescriptor = JSON.stringify(config);

        const parsedJobSteps = await JobPartsParser.with(config).parseJobStepDescriptors();

        instance.jobSteps.push(...parsedJobSteps);

        return instance;
    }
}
