import { DaemonConfig } from "../ApplicationModel/Daemon/DaemonConfig.model.js";
import { AdaptiveGradingConfigProvider } from "./AdaptiveGradingConfigProvider.js";
import { IConfiguredJobService, JobService } from "../JobService.js";
import { EdgarStatProcJobProvider } from "../ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobProvider.js";
import { DatabaseConnectionRegistry } from "../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { RegistryDefaultConstants } from "../PluginSupport/RegistryDefault.constants.js";
import { randomUUID } from "crypto";
import { IJobConfiguration } from "../ApplicationModel/Jobs/IJobConfiguration.js";
import { EdgarStatProcJobConfiguration } from "../ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobConfiguration.js";
import { DatabaseConnection } from "../ApplicationModel/Database/DatabaseConnection.js";
import { IStartJobRequest } from "../ApplicationModel/Models/IStartJobRequest.js";
import { FrameworkLogger } from "../Logger/FrameworkLogger.js";
import { JobRequestParserRegistry } from "../PluginSupport/Registries/Implementation/JobRequestParserRegistry.js";
import { EdgarStatsProcessingConstants } from "../ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { EdgarStatisticsProcessingJobRequestParser } from "../ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/EdgarStatisticsProcessingJobRequestParser.js";
import { GenericCheckInfo, JobExecutionDaemonBase } from "../ApplicationModel/Daemon/JobExecutionDaemonBase.js";
import { CourseStatisticsCalculationQueue, CourseStatisticsProcessingRequest } from "./StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { AdaptiveGradingDaemonConfig } from "./AdaptiveGradingDaemonConfig.model.js";

type ForceShutdownHandler<TSource> = (source: TSource, reason?: string) => void;

export class AdaptiveGradingDaemon extends JobExecutionDaemonBase {
    protected async parseConfigFile(filePath: string): Promise<DaemonConfig> {
        if (AdaptiveGradingConfigProvider.instance.hasConfiguration()) {
            console.log(
                "[WARN]: Configuration was previously loaded into the config provider singleton; using that " +
                `configuration instead of configuration file: ${filePath}`
            );
        } else {
            await AdaptiveGradingConfigProvider.instance.parseConfigFile(filePath);
        }

        return AdaptiveGradingConfigProvider.instance.getConfiguration();
    }

    protected async isConfigurationInvalid(configuration: DaemonConfig): Promise<boolean> {
        return !("resultStalenessInterval" in configuration);
    }

    protected async getRefreshCheckInfo(): Promise<GenericCheckInfo | null> {
        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            return null;
        }

        return {
            jobTypeAbbrev: "STATPROC",
            configurationParser: async (jobCfg) => {
                return await EdgarStatProcJobConfiguration.fromGenericJobConfig(
                    jobCfg,
                    undefined,
                    () => `[JobPeriodicalRestart] - Periodical restart for job: (${jobCfg.jobId})
        Previous name: ${jobCfg.jobName}`
                );
            },
            completionListener: async (errored, error, jobConfig, transaction) => {
                if (errored) {
                    return null;
                }

                const newJobConfig = <EdgarStatProcJobConfiguration>jobConfig;

                try {
                    const acYear = await transaction.doQuery<{ id: number }>(
                        `SELECT *
                        FROM public.academic_year
                        WHERE CURRENT_DATE BETWEEN date_start AND date_end`
                    );

                    if (acYear === null || acYear.count === 0) {
                        throw new Error("Could not determine current academic year");
                    }

                    const recalculableYears = [acYear.rows[0].id, acYear.rows[0].id - 1];
                    const newConfstartAcYear =
                        newJobConfig.inputExtractorConfig.configContent.idStartAcademicYear;

                    return {
                        jobId: newJobConfig.jobId,
                        setPeriodical: recalculableYears.includes(newConfstartAcYear),
                    };
                } catch (err) {
                    console.log(err);
                    await transaction.rollback();
                    return null;
                }
            }
        }
    }

    protected async getRecalculationCheckInfo(): Promise<GenericCheckInfo | null> {
        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            return null;
        }

        return {
            jobTypeAbbrev: "STATPROC",
            configurationParser: async (jobCfg) => {
                return await EdgarStatProcJobConfiguration.fromGenericJobConfig(
                    jobCfg,
                    undefined,
                    () => `[JobPeriodicalRestart] - Periodical restart for job: (${jobCfg.jobId})
        Previous name: ${jobCfg.jobName}`
                );
            },
        };
    }

    protected async configureJobService(configuration: DaemonConfig): Promise<IConfiguredJobService | null> {
        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            FrameworkLogger.error(AdaptiveGradingDaemon, "Unable to fetch database connection");
            return null;
        }

        return JobService.configureNew()
            .useProvider(
                new EdgarStatProcJobProvider(
                    dbConn,
                    new CourseStatisticsCalculationQueue(
                        `StatProcQueueInst${randomUUID()}`,
                        this.usedWorkQueue!,
                    ),
                    configuration?.maxJobTimeoutMs ?? AdaptiveGradingDaemon.defaultMaxJobTimeout,
                    []
                )
            )
            .withConcurrentJobRunners(configuration.maxAllowedConcurrentCalculations ?? 1)
            .build();
    }

    protected async expandConfigFromRequest(
        request: IStartJobRequest<object>,
        configuration: DaemonConfig,
    ): Promise<IJobConfiguration | null> {
        const req = (<IStartJobRequest<CourseStatisticsProcessingRequest>>request);
        const config = (<AdaptiveGradingDaemonConfig>configuration);
        return await JobRequestParserRegistry.instance
            .getItem<EdgarStatisticsProcessingJobRequestParser>(
                EdgarStatsProcessingConstants.JOB_REQUEST_PARSER_ENTRY
            )
            ?.fromJobRequest({
                startJobReq: req,
                calculationsValidFor: configuration.resultStalenessInterval,
                
                calculationConfig: config.calculationConfig,
                jobQueue: this.usedWorkQueue!.queueName,
                
                jobName: req.jobName ??
                    `Statistics calculation job for course with ID '${req.request.idCourse}' ` +
                        `started @ '${new Date().toISOString()}'`,
                jobTimeoutMs: req.jobMaxTimeoutMs ?? 
                    configuration.maxJobTimeoutMs ??
                    AdaptiveGradingDaemon.defaultMaxJobTimeout,
            }) ?? null;
    }

    protected async additionalShutdownLogic(sdType: "forced" | "graceful"): Promise<void> {
        return;
    }

    constructor(
        configFilePath: string,
        forceShutdownHandler?: ForceShutdownHandler<JobExecutionDaemonBase>
    ) { super(configFilePath, "Adaptive grading daemon", forceShutdownHandler) }

    //#region Daemon running logic
    protected override async runAutoJobStart(configuration: DaemonConfig | null) {
        FrameworkLogger.info(AdaptiveGradingDaemon, "Running scheduled auto job start...");

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            FrameworkLogger.warn(AdaptiveGradingDaemon, "Unable to fetch database connection");
            return;
        }

        const courseIds = await dbConn.doQuery<{ id: number }>(
            `SELECT public.course.id
            FROM public.course
                LEFT JOIN statistics_schema.question_param_calculation
                    ON public.course.id = statistics_schema.question_param_calculation.id_based_on_course
            WHERE statistics_schema.question_param_calculation.id IS NULL`
        );

        if (courseIds === null || courseIds.count === 0) {
            return;
        }

        const idCourseObj = courseIds.rows[Math.floor(Math.random() * (courseIds.count - 1))];
        if (configuration === null) {
            throw new Error("Daemon not properly configured");
        }

        const config = (<AdaptiveGradingDaemonConfig>configuration);

        const request: IStartJobRequest<CourseStatisticsProcessingRequest> =
            { ...config.autoJobStartInfo.startJobRequest };

        request.request.idCourse = idCourseObj.id;

        this.usedRequestQueue?.enqueue(request);

        FrameworkLogger.info(AdaptiveGradingDaemon, "Scheduled auto job start executed. Executed job: ", request);
    }
    //#endregion
}
