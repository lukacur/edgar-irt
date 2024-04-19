import { ScanInterval } from "../../../../../AdaptiveGradingDaemon/DaemonConfig.model.js";
import { CourseStatisticsProcessingRequest } from "../../../../../AdaptiveGradingDaemon/Queue/StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { BlockingConfig, DataPersistorConfig, IJobConfiguration, InputExtractorConfig, JobStepDescriptor, JobWorkerConfig } from "../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { IJobStep } from "../../../../../ApplicationModel/Jobs/IJobStep.js";
import { IStartJobRequest } from "../../../../../ApplicationModel/Models/IStartJobRequest.js";
import { RegistryDefaultConstants } from "../../../../../PluginSupport/RegistryDefault.constants.js";
import { JobPartsParser } from "../../../../../Util/JobPartsParser.js";
import { CourseBasedBatch } from "../../../Batches/CourseBasedBatch.js";
import { EdgarStatsProcessingConstants } from "../../../EdgarStatsProcessing.constants.js";
import { EdgarStatProcDataExtractorConfiguration } from "../DataExtractor/EdgarStatProcDataExtractorConfiguration.js";
import { CheckIfCalculationNeededStep } from "../Steps/CheckIfCalculationNeeded/CheckIfCalculationNeededStep.js";
import { CheckIfCalculationNeededStepConfiguration } from "../Steps/CheckIfCalculationNeeded/CheckIfCalculationNeededStepConfiguration.js";
import { EdgarStatProcStepConfiguration } from "../Steps/StatisticsProcessing/EdgarStatProcStepConfiguration.js";

export class EdgarStatProcJobConfiguration implements IJobConfiguration {
    public readonly jobTypeAbbrevation = "STATPROC";
    private readonly jobSteps: IJobStep[] = [];

    private rawDescriptor: string | null = null;

    constructor(
        public readonly jobId: string,
        public readonly jobName: string,
        public readonly idUserStarted: number | null,
        public readonly jobQueue: string | null,
        public readonly jobTimeoutMs: number,
        public readonly periodical: boolean,

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
        nameProvider?: (currentName: string) => string,
        forceCalculation = false,
    ): Promise<EdgarStatProcJobConfiguration> {
        const instance = new EdgarStatProcJobConfiguration(
            (jobIdProvider !== undefined) ? jobIdProvider(config.jobId) : config.jobId,
            (nameProvider !== undefined) ? nameProvider(config.jobName) : config.jobName,
            config.idUserStarted,
            config.jobQueue,
            config.jobTimeoutMs,
            config.periodical,
            <InputExtractorConfig<CourseBasedBatch>>config.inputExtractorConfig,
            config.jobWorkerConfig,
            config.dataPersistorConfig,
            config.blockingConfig,
        );
        
        instance.rawDescriptor = JSON.stringify({ ...config, jobTypeAbbrevation: instance.jobTypeAbbrevation });

        const parsedJobSteps = await JobPartsParser.with(config).parseJobStepDescriptors();

        instance.jobSteps.push(...parsedJobSteps);

        const idx = instance.jobSteps.findIndex(js => js instanceof CheckIfCalculationNeededStep && forceCalculation);
        if (idx !== -1) {
            instance.jobSteps.splice(idx, 1);
        }

        return instance;
    }

    public static async fromStatisticsProcessingRequest(
        startJobReq: IStartJobRequest<CourseStatisticsProcessingRequest>,
        calculationsValidFor: ScanInterval,

        calculationConfig: {
            useJudge0: true,
        } |
        {
            useJudge0: false,
            scriptPath: string,
            outputFile: string,
            generatedJSONInputPath: string,
        },

        jobQueue: string | null,

        jobName?: string,
        jobTimeoutMs: number = 200000,
        stalenessCheckTimeoutMs: number = 5000,
        statProcessingTimeoutMs: number = 150000,
    ) {
        const statProcReq = startJobReq.request;

        let remainingJobTime: number = startJobReq.jobMaxTimeoutMs ?? jobTimeoutMs;

        const ieConfig: EdgarStatProcDataExtractorConfiguration = {
            databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
            idCourse: statProcReq.idCourse,
            idStartAcademicYear: statProcReq.idStartAcademicYear,
            numberOfIncludedPreviousYears: statProcReq.numberOfIncludedPreviousYears,
        };

        const cicnsConfig: CheckIfCalculationNeededStepConfiguration = {
            calculationsValidFor,
            forceCalculation: statProcReq.forceCalculation,
            databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
        };

        const dpConfig: { databaseConnection?: string } = {
            databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
        };

        const jobSteps: JobStepDescriptor[] = [
            {
                type: EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY,
                configContent: cicnsConfig,
                isCritical: true,
                stepTimeoutMs: stalenessCheckTimeoutMs,
            },
        ];
        remainingJobTime -= stalenessCheckTimeoutMs;

        if (!calculationConfig.useJudge0) {
            const statCalcConfig: EdgarStatProcStepConfiguration = {
                calculationScriptAbsPath: calculationConfig.scriptPath,
                outputFile: calculationConfig.outputFile,
                inputJSONInfoAbsPath: calculationConfig.generatedJSONInputPath,
            };

            jobSteps.push(
                {
                    type: EdgarStatsProcessingConstants.STATISTICS_CALCULATION_STEP_ENTRY,
                    configContent: statCalcConfig,
                    isCritical: true,
                    stepTimeoutMs: statProcessingTimeoutMs,
                }
            );
        } else {
            throw new Error("Not implemented");
        }

        remainingJobTime -= statProcessingTimeoutMs;

        return await EdgarStatProcJobConfiguration.fromGenericJobConfig(
            {
                jobId: undefined!,
                jobName: jobName ?? `Edgar statistics processing job started @ ${new Date().toISOString()}`,
                jobTypeAbbrevation: "STATPROC",
                periodical: startJobReq.periodical,

                idUserStarted: startJobReq.idUserRequested ?? null,
                jobTimeoutMs,
                jobQueue,

                blockingConfig: {
                    awaitDataExtraction: true,
                    persistResultInBackground: false,
                    workInBackground: false,
                },
                inputExtractorConfig: {
                    type: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY,
                    configContent: ieConfig,
                },
                jobWorkerConfig: {
                    type: EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY,
                    databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                    steps: jobSteps,
                },
                dataPersistorConfig: {
                    type: EdgarStatsProcessingConstants.DATA_PERSISTOR_REGISTRY_ENTRY,
                    persistanceTimeoutMs: remainingJobTime,
                    configContent: dpConfig,
                },
            }
        )
    }
}
