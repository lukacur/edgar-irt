import { readFile } from "fs/promises";
import { IConfiguredJobService, JobService } from "../../JobService.js";
import { IJobConfiguration } from "../Jobs/IJobConfiguration.js";
import { IStartJobRequest } from "../Models/IStartJobRequest.js";
import { DaemonConfig } from "./DaemonConfig.model.js";
import { GenericCheckInfo, JobExecutionDaemonBase } from "./JobExecutionDaemonBase.js";
import { DatabaseConnection } from "../Database/DatabaseConnection.js";
import { DatabaseConnectionRegistry } from "../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { FrameworkLogger } from "../../Logger/FrameworkLogger.js";
import { GenericJobProvider } from "./GenericJobProvider.js";
import { JobRequestParserRegistry } from "../../PluginSupport/Registries/Implementation/JobRequestParserRegistry.js";

export interface IGenericDaemonConfig extends DaemonConfig {
    jobTypeAbbrev: string;
    dbConnKey: string;
    jobRequestParserKey: string;

    extraConfig: object;
}

export class GenericJobExecutionDaemon extends JobExecutionDaemonBase {
    private myConfig: IGenericDaemonConfig | null = null;

    protected async parseConfigFile(filePath: string): Promise<DaemonConfig> {
        if (this.myConfig === null) {
            this.myConfig = JSON.parse(
                await readFile(filePath, { encoding: "utf-8" })
            );
        }
        
        return this.myConfig!;
    }

    protected async isConfigurationInvalid(configuration: DaemonConfig): Promise<boolean> {
        return "jobTypeAbbrev" in configuration && "dbConnKey" in configuration;
    }

    protected async getRefreshCheckInfo(): Promise<GenericCheckInfo | null> {
        if (this.myConfig === null) {
            throw new Error("Invalid daemon configuration");
        }

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(this.myConfig.dbConnKey);
        if (dbConn === null) {
            return null;
        }

        return {
            jobTypeAbbrev: this.myConfig.jobTypeAbbrev,
            configurationParser: async (jobCfg) => jobCfg,
            completionListener: async (errored, error, jobConfig, transaction) => {
                if (errored) {
                    return null;
                }

                return {
                    jobId: jobConfig.jobId,
                    setPeriodical: jobConfig.periodical,
                };
            }
        }
    }

    protected async getRecalculationCheckInfo(): Promise<GenericCheckInfo | null> {
        if (this.myConfig === null) {
            throw new Error("Invalid daemon configuration");
        }

        return {
            jobTypeAbbrev: this.myConfig.jobTypeAbbrev,
            configurationParser: async (jobCfg) => jobCfg,
        };
    }

    protected async runAutoJobStart(configuration: DaemonConfig | null): Promise<void> {
        FrameworkLogger.info(
            GenericJobExecutionDaemon,
            "GenericJobExecutionDaemon only provides simple configuration without additional configuration. Implement" +
                " your own daemon in order to use advanced configuration."
        );
        FrameworkLogger.info(GenericJobExecutionDaemon, "Running scheduled auto job start...");
        const config = (<IGenericDaemonConfig>configuration);

        const request: IStartJobRequest<object> =
            { ...config.autoJobStartInfo.startJobRequest };

        this.usedRequestQueue?.enqueue(request);

        FrameworkLogger.info(GenericJobExecutionDaemon, "Scheduled auto job start executed. Executed job: ", request);
    }

    protected async configureJobService(configuration: DaemonConfig): Promise<IConfiguredJobService | null> {
        if (this.myConfig === null || this.usedWorkQueue === null) {
            throw new Error("Invalid daemon configuration");
        }

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(this.myConfig.dbConnKey);
        if (dbConn === null) {
            FrameworkLogger.error(GenericJobExecutionDaemon, "Unable to fetch database connection");
            return null;
        }

        return JobService.configureNew()
            .useProvider(
                new GenericJobProvider(
                    dbConn,
                    this.usedWorkQueue,
                    configuration?.maxJobTimeoutMs ?? GenericJobExecutionDaemon.defaultMaxJobTimeout,
                )
            )
            .withConcurrentJobRunners(configuration.maxAllowedConcurrentCalculations ?? 1)
            .build();
    }

    protected async expandConfigFromRequest(request: IStartJobRequest<object>, configuration: DaemonConfig): Promise<IJobConfiguration | null> {
        if (this.myConfig === null || this.usedWorkQueue === null) {
            throw new Error("Invalid daemon configuration");
        }

        const req = (<IStartJobRequest<object>>request);
        const config = (<IGenericDaemonConfig>configuration);
        return await JobRequestParserRegistry.instance
            .getItem(this.myConfig.jobRequestParserKey)
            ?.fromJobRequest({
                startJobReq: req,
                calculationsValidFor: configuration.resultStalenessInterval,
                
                extraConfig: config.extraConfig,
                jobQueue: this.usedWorkQueue!.queueName,
                
                jobName: req.jobName ??
                    `An unknown job started by a generic job execution daemon @ ${new Date().toISOString()}`,
                jobTimeoutMs: req.jobMaxTimeoutMs ?? 
                    configuration.maxJobTimeoutMs ??
                    GenericJobExecutionDaemon.defaultMaxJobTimeout,
            }) ?? null;
    }

    protected async additionalShutdownLogic(sdType: "forced" | "graceful"): Promise<void> {
        return;
    }
}
