import { DaemonConfig, QueueDescriptor, ScanInterval } from "./DaemonConfig.model.js";
import { QueueClosedException } from "../../Exceptions/QueueClosedException.js";
import { DatabaseConnection } from "../../ApplicationImplementation/Database/DatabaseConnection.js";
import { ErrorReport, JobCompletionListener } from "../../JobRunner.js";
import { IConfiguredJobService } from "../../JobService.js";
import { FrameworkLogger } from "../../Logger/FrameworkLogger.js";
import { DatabaseConnectionRegistry } from "../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { RegistryDefaultConstants } from "../../PluginSupport/RegistryDefault.constants.js";
import { DelayablePromise } from "../../Util/DelayablePromise.js";
import { TimeoutUtil } from "../../Util/TimeoutUtil.js";
import { FrameworkConfigurationProvider } from "../FrameworkConfiguration/FrameworkConfigurationProvider.js";
import { IJobConfiguration } from "../Jobs/IJobConfiguration.js";
import { IStartJobRequest } from "../Models/IStartJobRequest.js";
import { IQueueSystemBase } from "../Queue/IQueueSystemBase.js";
import { QueueRegistry } from "../Queue/QueueRegistry.js";
import { DirQueueSystem } from "../Queue/QueueSystemImplementations/DirQueueSystem.js";
import { FileQueueSystem } from "../Queue/QueueSystemImplementations/FileQueueSystem.js";
import { PgBossQueueSystem } from "../Queue/QueueSystemImplementations/PgBossQueueSystem.js";
import { TransactionContext } from "../../ApplicationImplementation/Database/TransactionContext.js";

type ForceShutdownHandler<TSource> = (source: TSource, reason?: string) => void;

type DaemonShutdownType = "forced" | "graceful";

type CompletionActionResult =
{
    jobId: string;
} &
(
  {
    setPeriodical: boolean;
  } |
  {
    setRerun: boolean;
  } |
  {}
);

type ExtendedCompletionListener =
    (
        errored: boolean,
        error: ErrorReport | null,
        jobConfiguration: IJobConfiguration,
        transactionCtx: TransactionContext
    ) => Promise<CompletionActionResult | null>;

export type GenericCheckInfo = {
    jobTypeAbbrev: string,
    configurationParser: (jobCfg: IJobConfiguration) => Promise<IJobConfiguration>,
    completionListener?: ExtendedCompletionListener
};

export abstract class JobExecutionDaemonBase {
    private configuration: DaemonConfig | null = null;

    protected usedRequestQueue: IQueueSystemBase<IStartJobRequest<object>> | null = null;
    protected usedWorkQueue: IQueueSystemBase<IJobConfiguration> | null = null;

    private static setupQueue<TQueueItem extends object>(
        queueDescriptor: QueueDescriptor
    ): IQueueSystemBase<TQueueItem> | null {
        let theQueue: IQueueSystemBase<TQueueItem> | null;

        switch (queueDescriptor.type) {
            case "dir": {
                const fnSuffix = queueDescriptor.suffix;
                theQueue = new DirQueueSystem(
                    queueDescriptor.queueName,
                    queueDescriptor.location,
                    {
                        prefix: queueDescriptor.prefix,
                        name: queueDescriptor.name,
                        suffixProvider: (() => {
                            let index = 0;
                            return () => `${fnSuffix}_${index++}`;
                        })()
                    }
                );

                break;
            }

            case "file": {
                theQueue = new FileQueueSystem(
                    queueDescriptor.queueName,
                    queueDescriptor.location
                );

                break;
            }

            case "pg_boss": {
                if (!queueDescriptor.connectionString && !queueDescriptor.configuration) {
                    throw new Error(
                        "Invalid pg_boss queue system configuration: missing connection string or configuration entry"
                    );
                }
                theQueue = new PgBossQueueSystem(
                    queueDescriptor.queueName,
                    queueDescriptor.connectionString ?? queueDescriptor.configuration!,
                )
                break;
            }

            default: {
                theQueue = null;
            }
        }

        return theQueue;
    }

    protected abstract parseConfigFile(filePath: string): Promise<DaemonConfig>;
    protected abstract isConfigurationInvalid(configuration: DaemonConfig): Promise<boolean>;

    private async readConfiguration(configFilePath: string): Promise<void> {
        let configuration: DaemonConfig = await this.parseConfigFile(configFilePath);
        if (await this.isConfigurationInvalid(configuration)) {
            throw new Error(`Unable to parse given configuration file at: ${configFilePath}`);
        }

        console.log("[INFO] Daemon: Setting up request queue...");
        this.usedRequestQueue = JobExecutionDaemonBase.setupQueue(configuration.incomingWorkRequestQueue);
        console.log("[INFO] Daemon: Done");
        
        console.log("[INFO] Daemon: Setting up work queue...");
        this.usedWorkQueue = JobExecutionDaemonBase.setupQueue(configuration.jobRunnerWorkingQueue);
        console.log("[INFO] Daemon: Done");

        console.log(`[INFO] Daemon: Set up following queues: request: ${this.usedRequestQueue?.queueName}; work: ${this.usedWorkQueue?.queueName}`);

        if (
            this.usedRequestQueue === null || this.usedWorkQueue === null ||
                !(
                    QueueRegistry.instance.registerQueue(this.usedRequestQueue.queueName, this.usedRequestQueue) &&
                        QueueRegistry.instance.registerQueue(this.usedWorkQueue.queueName, this.usedWorkQueue)
                )
        ) {
            throw new Error("Unable to setup queues used by the daemon");
        }

        this.configuration = configuration;
    }

    constructor(
        private readonly configFilePath: string,
        private readonly friendlyName?: string,
        private readonly forceShutdownHandler?: ForceShutdownHandler<JobExecutionDaemonBase>
    ) { this.friendlyName ??= "Generic job execution daemon"; }

    private stopSignalProm = new DelayablePromise<DaemonShutdownType>();
    private runningProm: Promise<void> | null = null;

    protected static getIntervalMillis(scanInterval: ScanInterval): number {
        return (
            (scanInterval.days ?? 0) * (24 * 3600 * 1000) +
            (scanInterval.hours ?? 0) * (3600 * 1000) +
            (scanInterval.minutes ?? 0) * (60 * 1000) +
            (scanInterval.seconds ?? 0) * (1000)
        );
    }

    //#region Daemon running logic
    protected static readonly defaultMaxJobTimeout = 200000;
    private backedJobService: IConfiguredJobService | null = null;

    private async runRefreshCheck(
        jobTypeAbbrev: string,
        configurationParser: (jobCfg: IJobConfiguration) => Promise<IJobConfiguration>,
        completionListener?: ExtendedCompletionListener,
    ) {
        FrameworkLogger.info(JobExecutionDaemonBase, "Running scheduled refresh check...");

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            FrameworkLogger.warn(JobExecutionDaemonBase, "Unable to fetch database connection");
            return;
        }

        const escapedSchemaName =
            await dbConn.escapeIdentifier(FrameworkConfigurationProvider.instance.getJobSchemaName());

        const jobsToRefresh = await dbConn.doQuery<{ id: string, job_definition: IJobConfiguration }>(
            `SELECT ${escapedSchemaName}.job.id,
                    ${escapedSchemaName}.job.job_definition
            FROM ${escapedSchemaName}.job
                JOIN ${escapedSchemaName}.job_type
                    ON ${escapedSchemaName}.job_type.id = job.id_job_type
            WHERE ${escapedSchemaName}.job_type.abbrevation = $1 AND
                    periodical`,
            [ jobTypeAbbrev ]
        );

        for (const oldJob of (jobsToRefresh?.rows ?? [])) {
            const newJobConfig: IJobConfiguration = await configurationParser(oldJob.job_definition);

            const lst: JobCompletionListener = async (errored, error) => {
                const txCtx = await dbConn.beginTransaction(FrameworkConfigurationProvider.instance.getJobSchemaName());
                try {
                    await txCtx.doQuery(
                        `UPDATE ${escapedSchemaName}.job SET periodical = FALSE WHERE id = $1`,
                        [oldJob.id]
                    );

                    if ((completionListener ?? null) !== null) {
                        const res = await completionListener!(errored, error, newJobConfig, txCtx);
                        if (res !== null) {
                            const setPeriodical = ("setPeriodical" in res) ? res.setPeriodical : false;
    
                            await txCtx.doQuery(
                                `UPDATE ${escapedSchemaName}.job SET periodical = $1 WHERE id = $2`,
                                [
                                    /* $1 */ setPeriodical,
                                    /* $2 */ res.jobId
                                ],
                            );
                        }
                    }

                    if (!txCtx.isFinished()) {
                        await txCtx.commit();
                    }
                } catch (err) {
                    await txCtx.rollback();
                    console.log(err);
                } finally {
                    if (!txCtx.isFinished()) {
                        await txCtx.rollback();
                    }
                }

                this.backedJobService?.getJobRunners().forEach(jr =>
                    jr.removeJobCompletionListener(
                        newJobConfig.jobId,
                        lst,
                    )
                );
            };

            this.backedJobService?.getJobRunners()
                .forEach(jr => jr.addJobCompletionListener(newJobConfig.jobId, lst));

            this.usedWorkQueue?.enqueue(newJobConfig);
        }

        FrameworkLogger.info(JobExecutionDaemonBase, "Scheduled refresh check done");
    }

    private readonly registeredTimeoutIdFetchFunctions: (() => (NodeJS.Timeout | null))[] = [];

    protected abstract getRefreshCheckInfo(): Promise<GenericCheckInfo | null>;
    private async startRefreshCheckTracking(): Promise<void> {
        FrameworkLogger.info(JobExecutionDaemonBase, "Result staleness check interval found, configuring...");

        const getIntervalTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
            JobExecutionDaemonBase.getIntervalMillis(this.configuration!.calculationRefreshInterval),
            async () => {
                if (this.stopSignalProm.isFinished()) {
                    const tid = getIntervalTimeoutId();

                    if (tid !== null) {
                        clearTimeout(tid);
                    }
                    return;
                }

                const rcInfo = await this.getRefreshCheckInfo();
                if (rcInfo === null) {
                    throw new Error("Unable to get information to run the refresh check");
                }
                
                await this.runRefreshCheck(rcInfo.jobTypeAbbrev, rcInfo.configurationParser, rcInfo.completionListener);
            },
        );

        this.registeredTimeoutIdFetchFunctions.push(getIntervalTimeoutId);
    }

    private async runRecalculationCheck(
        jobTypeAbbrev: string,
        configurationParser: (jobCfg: IJobConfiguration) => Promise<IJobConfiguration>,
        completionListener?: ExtendedCompletionListener,
    ) {
        FrameworkLogger.info(JobExecutionDaemonBase, "Running scheduled recalculation check...");

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            FrameworkLogger.warn(JobExecutionDaemonBase, "Unable to fetch database connection");
            return;
        }

        const escapedSchemaName =
            await dbConn.escapeIdentifier(FrameworkConfigurationProvider.instance.getJobSchemaName());

        const jobsToRerun = await dbConn.doQuery<{ id: string, job_definition: IJobConfiguration }>(
            `SELECT ${escapedSchemaName}.job.id,
                    ${escapedSchemaName}.job.job_definition
            FROM ${escapedSchemaName}.job
                JOIN ${escapedSchemaName}.job_type
                    ON ${escapedSchemaName}.job_type.id = job.id_job_type
            WHERE ${escapedSchemaName}.job_type.abbrevation = $1 AND
                    rerun_requested`,
            [ jobTypeAbbrev ]
        );

        for (const oldJob of (jobsToRerun?.rows ?? [])) {
            const newJobConfig: IJobConfiguration = await configurationParser(oldJob.job_definition);

            const lst: JobCompletionListener = async (errored, error) => {
                const txCtx = await dbConn.beginTransaction(FrameworkConfigurationProvider.instance.getJobSchemaName());
                try {
                    await txCtx.doQuery(
                        `UPDATE ${escapedSchemaName}.job SET rerun_requested = FALSE WHERE id = $1`,
                        [oldJob.id],
                    );

                    await txCtx.doQuery(
                        `UPDATE ${escapedSchemaName}.job SET rerun_requested = FALSE WHERE id = $1`,
                        [newJobConfig.jobId],
                    );

                    if ((completionListener ?? null) !== null) {
                        const res = await completionListener!(errored, error, newJobConfig, txCtx);
                        if (res !== null) {
                            const setRerun = ("setRerun" in res) ? res.setRerun : false;
    
                            await txCtx.doQuery(
                                `UPDATE ${escapedSchemaName}.job SET rerun_requested = $1 WHERE id = $2`,
                                [
                                    /* $1 */ setRerun,
                                    /* $2 */ res.jobId
                                ],
                            );
                        }
                    }


                    if (!txCtx.isFinished()) {
                        await txCtx.commit();
                    }
                } catch (err) {
                    await txCtx.rollback();
                    console.log(err);
                } finally {
                    if (!txCtx.isFinished()) {
                        await txCtx.rollback();
                    }
                }

                this.backedJobService?.getJobRunners().forEach(jr =>
                    jr.removeJobCompletionListener(
                        newJobConfig.jobId,
                        lst,
                    )
                );
            };

            this.backedJobService?.getJobRunners()
                .forEach(jr => jr.addJobCompletionListener(newJobConfig.jobId, lst));

            this.usedWorkQueue?.enqueue(newJobConfig);
        }

        FrameworkLogger.info(JobExecutionDaemonBase, "Scheduled recalculation check done");
    }

    protected abstract getRecalculationCheckInfo(): Promise<GenericCheckInfo | null>;
    private async startRecalculationCheckTracking(): Promise<void> {
        FrameworkLogger.info(JobExecutionDaemonBase, "Recalculation check interval found, configuring...");

        const getIntervalTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
            JobExecutionDaemonBase.getIntervalMillis(this.configuration!.recalculationCheckInterval),
            async () => {
                if (this.stopSignalProm.isFinished()) {
                    const tid = getIntervalTimeoutId();

                    if (tid !== null) {
                        clearTimeout(tid);
                    }
                    return;
                }

                const recalcCheckInfo = await this.getRecalculationCheckInfo();
                if (recalcCheckInfo === null) {
                    throw new Error("Unable to get information to run the recalculation check");
                }
                
                await this.runRecalculationCheck(
                    recalcCheckInfo.jobTypeAbbrev,
                    recalcCheckInfo.configurationParser,
                    recalcCheckInfo.completionListener,
                );
            },
        );

        this.registeredTimeoutIdFetchFunctions.push(getIntervalTimeoutId);
    }

    protected abstract runAutoJobStart(configuration: DaemonConfig | null): Promise<void>;
    private async startAutoJobStartTracking(): Promise<void> {
        // TODO: Restart interval if new job requested by user applications
        FrameworkLogger.info(JobExecutionDaemonBase, "Auto job start configuration found, configuring...");

        const getIntervalTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
            JobExecutionDaemonBase.getIntervalMillis(this.configuration!.autoJobStartInfo.interval),
            async () => {
                if (this.stopSignalProm.isFinished()) {
                    const tid = getIntervalTimeoutId();

                    if (tid !== null) {
                        clearTimeout(tid);
                    }
                    return;
                }
                
                await this.runAutoJobStart(this.configuration);
            },
        );

        this.registeredTimeoutIdFetchFunctions.push(getIntervalTimeoutId);
    }

    protected abstract configureJobService(configuration: DaemonConfig): Promise<IConfiguredJobService | null>;
    protected abstract expandConfigFromRequest(
        request: IStartJobRequest<object>,
        configuration: DaemonConfig
    ): Promise<IJobConfiguration | null>;
    private async run(): Promise<void> {
        if (this.configuration === null || this.usedRequestQueue === null || this.usedWorkQueue === null) {
            throw new Error("Daemon not correctly configured");
        }

        const runDelProm = new DelayablePromise<void>();
        this.runningProm = runDelProm.getWrappedPromise();

        if (this.usedWorkQueue === null) {
            throw new Error(`Unable to get registered queue with name '${this.usedWorkQueue}'`);
        }

        const dbConn: DatabaseConnection | null = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (dbConn === null) {
            FrameworkLogger.error(JobExecutionDaemonBase, "Unable to fetch database connection");
            return;
        }

        this.backedJobService = await this.configureJobService(this.configuration);
        if (this.backedJobService === null) {
            FrameworkLogger.error(JobExecutionDaemonBase, "Unable to configure a job service");
            return;
        }

        this.backedJobService.startJobService();

        if (this.configuration.resultStalenessInterval) {
            this.startRefreshCheckTracking();
        } else {
            FrameworkLogger.info(JobExecutionDaemonBase, "Result staleness check interval not defined, skipping...");
        }
        
        if (this.configuration.recalculationCheckInterval) {
            this.startRecalculationCheckTracking();
        } else {
            FrameworkLogger.info(JobExecutionDaemonBase, "Recalculation check interval not defined, skipping...");
        }

        if (this.configuration.autoJobStartInfo) {
            this.startAutoJobStartTracking();
        } else {
            FrameworkLogger.info(JobExecutionDaemonBase, "Auto job start configuration not defined, skipping...");
        }

        FrameworkLogger.info(JobExecutionDaemonBase, `${this.friendlyName} booted up and waiting for requests`)
        while (!this.stopSignalProm.isFinished()) {
            let req: IStartJobRequest<object> = null!;
            try {
                req = await this.usedRequestQueue.dequeue();
            } catch (err) {
                if (err instanceof QueueClosedException) {
                    FrameworkLogger.info(
                        JobExecutionDaemonBase,
                        "The request queue was closed while waiting for incoming request"
                    );
                    break;
                }
            }

            FrameworkLogger.info(JobExecutionDaemonBase, "Incoming request", req);

            const newJobConfig = await this.expandConfigFromRequest(req, this.configuration);
            if (newJobConfig === null) {
                throw new Error("Unable to create a statistics processing job configuration");
            }

            const lst: JobCompletionListener = async (errored, error) => {
                if (errored) {
                    console.log(`[ERROR] Daemon: Job ${newJobConfig.jobId} finished in error`);
                    return;
                }

                console.log(`[INFO] Daemon: Job ${newJobConfig.jobId} successfully finished execution`);
                this.backedJobService?.getJobRunners().forEach(jr =>
                    jr.removeJobCompletionListener(
                        newJobConfig.jobId,
                        lst,
                    )
                );
            };

            this.backedJobService.getJobRunners()
                .forEach(jr => jr.addJobCompletionListener(newJobConfig.jobId, lst));

            await this.usedWorkQueue.enqueue(newJobConfig);
            FrameworkLogger.info(JobExecutionDaemonBase, `Request enqueued @ ${new Date().toISOString()}`);
        }

        FrameworkLogger.info(JobExecutionDaemonBase, `${this.friendlyName} detected a stop signal`);

        FrameworkLogger.info(JobExecutionDaemonBase, "Cleaning run context...");

        runDelProm.delayedResolve();
        FrameworkLogger.info(JobExecutionDaemonBase, "Run context clean, stopping...");
    }
    //#endregion

    //#region Daemon controls
    public async start(): Promise<void> {
        if (this.runningProm !== null) {
            throw new Error("Unable to start: daemon already running");
        }

        FrameworkLogger.info(JobExecutionDaemonBase,`${this.friendlyName} is booting up...`);

        // TODO: Eventually throw a typed UnableToStartDaemonException or something similar...
        await this.readConfiguration(this.configFilePath);

        this.stopSignalProm = new DelayablePromise();

        this.run();
    }

    protected abstract additionalShutdownLogic(sdType: DaemonShutdownType): Promise<void>;
    private async doShutdown(sdType: DaemonShutdownType): Promise<void> {
        if (this.runningProm === null) {
            throw new Error("Unable to shutdown: daemon not started");
        }

        FrameworkLogger.info(JobExecutionDaemonBase, "Received daemon shutdown request");
        await this.stopSignalProm.delayedResolve(sdType);
        FrameworkLogger.info(JobExecutionDaemonBase, "Daemon shutting down...");
        await this.usedWorkQueue?.close();
        await this.usedRequestQueue?.close();
        await this.backedJobService?.shutdownJobService();
        await this.runningProm;
        await this.additionalShutdownLogic(sdType);
        FrameworkLogger.info(JobExecutionDaemonBase, "Daemon shutdown successful");


        for (const tidFetcher of this.registeredTimeoutIdFetchFunctions) {
            const tid = tidFetcher();
            if (tid !== null) {
                clearTimeout(tid);
            }
        }
        this.registeredTimeoutIdFetchFunctions.splice(0, this.registeredTimeoutIdFetchFunctions.length);
    }

    public async shutdown(): Promise<void> {
        await this.doShutdown("graceful");
    }

    public async forceShutdown(reason?: string): Promise<void> {
        if (this.forceShutdownHandler) {
            this.forceShutdownHandler(this, reason);
        }

        try {
            await this.doShutdown("forced");
        } catch (_) {}
    }
    //#endregion
}
