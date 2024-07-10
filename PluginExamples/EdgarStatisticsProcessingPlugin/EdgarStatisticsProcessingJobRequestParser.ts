import { CalculationConfig } from "../../src/AdaptiveGradingDaemon/AdaptiveGradingDaemonConfig.model.js";
import { CourseStatisticsProcessingRequest } from "../../src/AdaptiveGradingDaemon/StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { EdgarStatsProcessingConstants } from "../../src/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { EdgarStatProcDataExtractorConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/DataExtractor/EdgarStatProcDataExtractorConfiguration.js";
import { EdgarStatProcJobConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobConfiguration.js";
import { CheckIfCalculationNeededStepConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/CheckIfCalculationNeeded/CheckIfCalculationNeededStepConfiguration.js";
import { EdgarIRTCalculationStepConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/IRTCalculation/EdgarIRTCalculationStepConfiguration.js";
import { EdgarQuestionClassificationStepConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/QuestionClassiffication/EdgarQuestionClassificationStepConfiguration.js";
import { EdgarJudge0StatProcStepConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/StatisticsProcessing/EdgarJudge0StatProcStepConfiguration.js";
import { EdgarStatProcStepConfiguration } from "../../src/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/StatisticsProcessing/EdgarStatProcStepConfiguration.js";
import { ScanInterval } from "../../src/ApplicationModel/Daemon/DaemonConfig.model.js";
import { IJobConfiguration, JobStepDescriptor } from "../../src/ApplicationModel/Jobs/IJobConfiguration.js";
import { IJobRunRequestParser } from "../../src/ApplicationModel/Jobs/IJobRunRequestParser.js";
import { IStartJobRequest } from "../../src/ApplicationModel/Models/IStartJobRequest.js";
import { IRegistryPlugin } from "../../src/PluginSupport/IRegistryPlugin.js";
import { RegistryDefaultConstants } from "../../src/PluginSupport/RegistryDefault.constants.js";

type TotalRequest = {
    startJobReq: IStartJobRequest<CourseStatisticsProcessingRequest>,
    calculationsValidFor: ScanInterval,

    calculationConfig: CalculationConfig,

    jobQueue: string | null,

    jobName?: string,
    jobTimeoutMs?: number,
    stalenessCheckTimeoutPerc?: number,
    statProcessingTimeoutPerc?: number,
}

export class EdgarStatisticsProcessingJobRequestParser implements IJobRunRequestParser<TotalRequest> {
    private static async fromStatisticsProcessingRequest<TReturnType extends "strict" | "generic">(
        returnType: TReturnType,

        startJobReq: IStartJobRequest<CourseStatisticsProcessingRequest>,
        calculationsValidFor: ScanInterval,

        calculationConfig: CalculationConfig,

        jobQueue: string | null,

        jobName?: string,
        jobTimeoutMs: number = 200000,
        stalenessCheckTimeoutPerc: number = 0.1,
        statProcessingTimeoutPerc: number = 0.7,
    ): Promise<(TReturnType extends 'strict' ? EdgarStatProcJobConfiguration : (TReturnType extends 'generic' ? IJobConfiguration : never))> {
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

        const jobSteps: JobStepDescriptor[] = [];

        if (!statProcReq.forceCalculation) {
            jobSteps.push(
                {
                    type: EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY,
                    configContent: cicnsConfig,
                    isCritical: true,
                    stepTimeoutMs: stalenessCheckTimeoutPerc * jobTimeoutMs,
                },
            );
            remainingJobTime -= (stalenessCheckTimeoutPerc * (1 - jobTimeoutMs));
        }

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
                    stepTimeoutMs: statProcessingTimeoutPerc * 0.7 * jobTimeoutMs,
                }
            );
        } else {
            const statCalcConfig: EdgarJudge0StatProcStepConfiguration = {
                judge0ServerAddress: calculationConfig.endpoint,
                languageId: calculationConfig.langId,
                stdin: calculationConfig.stdin,

                statisticsScriptPath: calculationConfig.statisticsScriptPath,

                judge0Authentication: calculationConfig.authentication,
                judge0Authorization: calculationConfig.authorization,
            };

            jobSteps.push(
                {
                    type: EdgarStatsProcessingConstants.JUDGE0_STATISTICS_CALCULATION_STEP_ENTRY,
                    configContent: statCalcConfig,
                    isCritical: true,
                    stepTimeoutMs: statProcessingTimeoutPerc * 0.7 * jobTimeoutMs,
                }
            );
        }

        const irtCalcConfig: EdgarIRTCalculationStepConfiguration = {
            jobId: null!
        };

        jobSteps.push(
            {
                type: EdgarStatsProcessingConstants.CALCULATE_IRT_PARAMETERS_STEP_ENTRY,
                configContent: irtCalcConfig,
                isCritical: true,
                stepTimeoutMs: statProcessingTimeoutPerc * 0.2 * jobTimeoutMs,
            }
        );

        const classificationConfig: EdgarQuestionClassificationStepConfiguration = {};

        jobSteps.push(
            {
                type: EdgarStatsProcessingConstants.CLASSIFY_QUESTION_STEP_ENTRY,
                configContent: classificationConfig,
                isCritical: true,
                stepTimeoutMs: statProcessingTimeoutPerc * 0.1 * jobTimeoutMs,
            }
        );

        remainingJobTime -= (statProcessingTimeoutPerc * (1 - statProcessingTimeoutPerc));

        const genericJobConfig: IJobConfiguration = {
            jobId: undefined!,
            jobName: jobName ?? `Edgar statistics processing job started @ ${new Date().toISOString()}`,
            jobTypeAbbrevation: "STATPROC",
            periodical: startJobReq.periodical,

            userNote: startJobReq.userNote ?? null,
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
        };

        if (returnType === "strict") {
            return await EdgarStatProcJobConfiguration.fromGenericJobConfig(genericJobConfig) as any;
        } else if (returnType === "generic") {
            return genericJobConfig as any;
        }

        return undefined as any;
    }

    public async fromJobRequest(request: TotalRequest): Promise<IJobConfiguration> {
        return await EdgarStatisticsProcessingJobRequestParser.fromStatisticsProcessingRequest(
            "generic",
            request.startJobReq,
            request.calculationsValidFor,

            request.calculationConfig,

            request.jobQueue,

            request.jobName,
            request.jobTimeoutMs,
            request.stalenessCheckTimeoutPerc,
            request.statProcessingTimeoutPerc,
        );
    }
}

const impl: IRegistryPlugin = {
    namespace: EdgarStatsProcessingConstants.JOB_REQUEST_PARSER_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.JOB_REQUEST_PARSER_ENTRY.split("/")[1],
    registry: "JobRequestParser",
    creationFunction(...args: any[]): object {
        return new EdgarStatisticsProcessingJobRequestParser();
    }
}

export default impl;
