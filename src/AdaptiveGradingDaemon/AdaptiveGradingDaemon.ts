import { Worker } from "worker_threads";
import { DelayablePromise } from "../Util/DelayablePromise.js";
import { DaemonConfig, DaemonOptions, QueueDescriptor, ScanInterval } from "./DaemonConfig.model.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { IQueueSystemBase } from "./Queue/IQueueSystemBase.js";
import { DirQueueSystem } from "./Queue/QueueSystemImplementations/DirQueueSystem.js";
import { FileQueueSystem } from "./Queue/QueueSystemImplementations/FileQueueSystem.js";
import { PgBossQueueSystem } from "./Queue/QueueSystemImplementations/PgBossQueueSystem.js";
import { QueueRegistry } from "./Queue/QueueRegistry.js";
import { AdaptiveGradingConfigProvider } from "../ApplicationImplementation/ApplicationConfiguration/AdaptiveGradingConfigProvider.js";
import { CourseStatisticsCalculationQueue, CourseStatisticsProcessingRequest } from "./Queue/StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { IConfiguredJobService, JobService } from "../JobService.js";
import { EdgarStatProcJobProvider } from "../ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobProvider.js";
import { DatabaseConnectionRegistry } from "../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { RegistryDefaultConstants } from "../PluginSupport/RegistryDefault.constants.js";
import { randomUUID } from "crypto";
import { IJobConfiguration } from "../ApplicationModel/Jobs/IJobConfiguration.js";
import { EdgarStatProcJobConfiguration } from "../ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobConfiguration.js";
import { DatabaseConnection } from "../ApplicationImplementation/Database/DatabaseConnection.js";
import { FrameworkConfigurationProvider } from "../ApplicationModel/FrameworkConfiguration/FrameworkConfigurationProvider.js";
import { TimeoutUtil } from "../Util/TimeoutUtil.js";
import { QueueClosedException } from "./Exceptions/QueueClosedException.js";
import { IStartJobRequest } from "../ApplicationModel/Models/IStartJobRequest.js";

type ForceShutdownHandler<TSource> = (source: TSource, reason?: string) => void;

type DaemonShutdownType = "forced" | "graceful";

export class AdaptiveGradingDaemon {
    private static readonly DEFAULT_OPTIONS: DaemonOptions = {
        waitForActionCompletion: true,
        actionProgress: { reportActionProgress: false, noReports: 0 },
    };

    private configuration: DaemonConfig | null = null;

    private usedRequestQueue: IQueueSystemBase<IStartJobRequest<CourseStatisticsProcessingRequest>> | null = null;
    private usedWorkQueue: IQueueSystemBase<IJobConfiguration> | null = null;

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

    private async readConfiguration(configFilePath: string): Promise<void> {
        if (AdaptiveGradingConfigProvider.instance.hasConfiguration()) {
            console.log(
                "[WARN]: Configuration was previously loaded into the config provider singleton; using that " +
                `configuration instead of configuration file: ${configFilePath}`
            );
        } else {
            await AdaptiveGradingConfigProvider.instance.parseConfigFile(configFilePath);
        }

        let configuration: DaemonConfig = AdaptiveGradingConfigProvider.instance.getConfiguration();
        if (!("scanInterval" in configuration)) {
            throw new Error(`Unable to parse given configuration file at: ${configFilePath}`);
        }

        console.log("[INFO] Daemon: Setting up request queue...");
        this.usedRequestQueue = AdaptiveGradingDaemon.setupQueue(configuration.incomingWorkRequestQueue);
        console.log("[INFO] Daemon: Done");
        
        console.log("[INFO] Daemon: Setting up work queue...");
        this.usedWorkQueue = AdaptiveGradingDaemon.setupQueue(configuration.jobRunnerWorkingQueue);
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
        private readonly intervalledAction: () => void | Promise<void>,
        private readonly options: DaemonOptions = AdaptiveGradingDaemon.DEFAULT_OPTIONS,
        private readonly forceShutdownHandler?: ForceShutdownHandler<AdaptiveGradingDaemon>
    ) {}

    private stopSignalProm = new DelayablePromise<DaemonShutdownType>();
    private runningProm: Promise<void> | null = null;

    private static getIntervalMillis(scanInterval: ScanInterval): number {
        return (
            (scanInterval.days ?? 0) * (24 * 3600 * 1000) +
            (scanInterval.hours ?? 0) * (3600 * 1000) +
            (scanInterval.minutes ?? 0) * (60 * 1000) +
            (scanInterval.seconds ?? 0) * (1000)
        );
    }

    //#region Daemon running logic
    private readonly runningActions: Promise<void>[] = [];
    
    private async actionRunner() {
        const prm = new DelayablePromise<void>();
        this.runningActions.push(prm.getWrappedPromise());

        if (this.options.waitForActionCompletion) {
            await this.intervalledAction();
        } else {
            this.intervalledAction();
        }

        prm.delayedResolve();

        if (this.runningActions.includes(prm.getWrappedPromise())) {
            this.runningActions.splice(
                this.runningActions.indexOf(prm.getWrappedPromise()),
                1
            );
        }
    }

    private reportWorker: Worker | null = null;

    private startReportWorker(): void {
        if ((this.configuration ?? null) === null) {
            throw new Error("Daemon not properly configured");
        }

        this.reportWorker = new Worker(
            path.join(fileURLToPath(import.meta.url), "..", "DaemonProgressReportWorker.js"),
            {
                workerData: {
                    intervalMillis: AdaptiveGradingDaemon.getIntervalMillis(this.configuration!.scanInterval),
                    noReports: this.options.actionProgress.noReports,
                }
            }
        );
    }

    private intervalWorker: Worker | null = null;

    private startIntervalWorker(): void {
        if ((this.configuration ?? null) === null) {
            throw new Error("Daemon not properly configured");
        }

        this.intervalWorker = new Worker(
            path.join(fileURLToPath(import.meta.url), "..", "DaemonIntervalWorker.js"),
            {
                workerData: {
                    intervalMillis: AdaptiveGradingDaemon.getIntervalMillis(this.configuration!.scanInterval),
                }
            }
        );
    }

    private static readonly defaultMaxJobTimeout = 200000;
    private backedJobService: IConfiguredJobService | null = null;

    private async runRefreshCheck() {
        const dbConn: DatabaseConnection = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );

        const escapedSchemaName =
            await dbConn.escapeIdentifier(FrameworkConfigurationProvider.instance.getJobSchemaName());

        const jobsToRefresh = await dbConn.doQuery<{ id: string, job_definition: IJobConfiguration }>(
            `SELECT ${escapedSchemaName}.job.id,
                    ${escapedSchemaName}.job.job_definition
            FROM ${escapedSchemaName}.job
                JOIN ${escapedSchemaName}.job_type
                    ON ${escapedSchemaName}.job_type.id = job.id_job_type
            WHERE ${escapedSchemaName}.job_type.abbrevation = 'STATPROC' AND
                    periodical`,
        );

        for (const oldJob of (jobsToRefresh?.rows ?? [])) {
            const newJobConfig: EdgarStatProcJobConfiguration = await EdgarStatProcJobConfiguration.fromGenericJobConfig(
                oldJob.job_definition,
                undefined,
                () => `[JobPeriodicalRestart] - Periodical restart for job: (${oldJob.job_definition.jobId})
    Previous name: ${oldJob.job_definition.jobName}`
            );

            this.backedJobService?.getJobRunner()
                .addJobCompletionListener(
                    newJobConfig.jobId,
                    async (errored, error) => {
                        if (errored) {
                            return;
                        }

                        const transaction = await dbConn.beginTransaction(
                            FrameworkConfigurationProvider.instance.getJobSchemaName()
                        );

                        try {
                            await transaction.doQuery(
                                `UPDATE ${escapedSchemaName}.job SET periodical = FALSE WHERE id = $1`,
                                [oldJob.id]
                            );
    
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
    
                            await transaction.doQuery(
                                `UPDATE ${escapedSchemaName}.job SET periodical = $1 WHERE id = $2`,
                                [
                                    /* $1 */ recalculableYears.includes(newConfstartAcYear),
                                    /* $2 */ newJobConfig.jobId
                                ],
                            );

                            await transaction.commit();
                        } catch (err) {
                            console.log(err);
                            await transaction.rollback();
                        } finally {
                            if (!transaction.isFinished()) {
                                transaction.rollback();
                            }
                        }
                    }
                );

            this.usedWorkQueue?.enqueue(newJobConfig);
        }
    }

    private readonly registeredTimeoutIdFetchFunctions: (() => (NodeJS.Timeout | null))[] = [];

    private async startRefreshCheckTracking(): Promise<void> {
        const getIntervalTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
            AdaptiveGradingDaemon.getIntervalMillis(this.configuration!.calculationRefreshInterval),
            async () => {
                if (this.stopSignalProm.isFinished()) {
                    const tid = getIntervalTimeoutId();

                    if (tid !== null) {
                        clearTimeout(tid);
                    }
                    return;
                }
                
                await this.runRefreshCheck();
            },
        );

        this.registeredTimeoutIdFetchFunctions.push(getIntervalTimeoutId);
    }

    private async runRecalculationCheck() {
        const dbConn: DatabaseConnection = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );

        const escapedSchemaName =
            await dbConn.escapeIdentifier(FrameworkConfigurationProvider.instance.getJobSchemaName());

        const jobsToRerun = await dbConn.doQuery<{ id: string, job_definition: IJobConfiguration }>(
            `SELECT ${escapedSchemaName}.job.id,
                    ${escapedSchemaName}.job.job_definition
            FROM ${escapedSchemaName}.job
                JOIN ${escapedSchemaName}.job_type
                    ON ${escapedSchemaName}.job_type.id = job.id_job_type
            WHERE ${escapedSchemaName}.job_type.abbrevation = 'STATPROC' AND
                    rerun_requested`,
        );

        for (const oldJob of (jobsToRerun?.rows ?? [])) {
            const newJobConfig: EdgarStatProcJobConfiguration = await EdgarStatProcJobConfiguration.fromGenericJobConfig(
                oldJob.job_definition,
                undefined,
                () => `[JobRerunRestart] - Periodical restart for job: (${oldJob.job_definition.jobId})
    Previous name: ${oldJob.job_definition.jobName}`,
                true,
            );
            newJobConfig.jobWorkerConfig

            this.backedJobService?.getJobRunner()
                .addJobCompletionListener(
                    newJobConfig.jobId,
                    async (errored, error) => {
                        if (errored) {
                            return;
                        }

                        const transaction = await dbConn.beginTransaction(
                            FrameworkConfigurationProvider.instance.getJobSchemaName()
                        );

                        try {
                            await transaction.doQuery(
                                `UPDATE ${escapedSchemaName}.job SET rerun_requested = FALSE WHERE id = $1`,
                                [oldJob.id],
                            );
    
                            await transaction.doQuery(
                                `UPDATE ${escapedSchemaName}.job SET rerun_requested = FALSE WHERE id = $1`,
                                [newJobConfig.jobId],
                            );

                            await transaction.commit();
                        } catch (err) {
                            console.log(err);
                            await transaction.rollback();
                        } finally {
                            if (!transaction.isFinished()) {
                                transaction.rollback();
                            }
                        }
                    }
                );

            this.usedWorkQueue?.enqueue(newJobConfig);
        }
    }

    private async startRecalculationCheckTracking(): Promise<void> {
        const getIntervalTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
            AdaptiveGradingDaemon.getIntervalMillis(this.configuration!.calculationRefreshInterval),
            async () => {
                if (this.stopSignalProm.isFinished()) {
                    const tid = getIntervalTimeoutId();

                    if (tid !== null) {
                        clearTimeout(tid);
                    }
                    return;
                }
                
                await this.runRecalculationCheck();
            },
        );

        this.registeredTimeoutIdFetchFunctions.push(getIntervalTimeoutId);
    }

    private async run(): Promise<void> {
        if (this.configuration === null || this.usedRequestQueue === null || this.usedWorkQueue === null) {
            throw new Error("Daemon not correctly configured");
        }

        const runDelProm = new DelayablePromise<void>();
        this.runningProm = runDelProm.getWrappedPromise();

        if (this.usedWorkQueue === null) {
            throw new Error(`Unable to get registered queue with name '${this.usedWorkQueue}'`);
        }

        this.backedJobService = JobService.configureNew()
            .useProvider(
                new EdgarStatProcJobProvider(
                    DatabaseConnectionRegistry.instance.getItem(
                        RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
                    ),
                    new CourseStatisticsCalculationQueue(
                        `StatProcQueueInst${randomUUID()}`,
                        this.usedWorkQueue,
                    ),
                    this.configuration?.maxJobTimeoutMs ?? AdaptiveGradingDaemon.defaultMaxJobTimeout,
                    []
                )
            )
            .build();


        this.backedJobService.startJobService();

        this.startRefreshCheckTracking();
        this.startRecalculationCheckTracking();

        console.log("[INFO] Daemon: Statistics processing daemon booted up and waiting for requests");
        while (!this.stopSignalProm.isFinished()) {
            let req: IStartJobRequest<CourseStatisticsProcessingRequest> = null!;
            try {
                req = await this.usedRequestQueue.dequeue();
            } catch (err) {
                if (err instanceof QueueClosedException) {
                    console.log("[INFO] Daemon: the request queue was closed while waiting for incoming request");
                    break;
                }
            }

            console.log("[INFO] Daemon: Incoming statistics processing request:", req);

            const newJobConfig = await EdgarStatProcJobConfiguration.fromStatisticsProcessingRequest(
                req,
                this.configuration.scanInterval,
                this.configuration.calculationConfig,
                this.usedWorkQueue.queueName,
                `Statistics calculation job for course with ID '${req.request.idCourse}' ` +
                    `started @ '${new Date().toISOString()}'`,
                this.configuration.maxJobTimeoutMs ?? AdaptiveGradingDaemon.defaultMaxJobTimeout,
            );

            this.backedJobService.getJobRunner()
                .addJobCompletionListener(
                    newJobConfig.jobId,
                    async (errored, error) => {
                        if (errored) {
                            console.log(`[ERROR] Daemon: Job ${newJobConfig.jobId} finished in error`);
                            return;
                        }

                        console.log(`[INFO] Daemon: Job ${newJobConfig.jobId} successfully finished execution`);
                    }
                );

            await this.usedWorkQueue.enqueue(newJobConfig);
            console.log(`[INFO] Daemon: Request enqueued @ ${new Date().toISOString()}`);
        }

        console.log("[INFO] Daemon: Statistics processing daemon detected a stop signal");
        console.log("[INFO] Daemon: Cleaning run context...");

        /*if (this.options.actionProgress.reportActionProgress) {
            this.startReportWorker();
        }

        this.startIntervalWorker();

        this.intervalWorker?.on("message", async (msg) => {
            this.reportWorker?.postMessage("refresh");
            await this.actionRunner();
        });

        const sdType = await this.stopSignalProm.getWrappedPromise();

        this.reportWorker?.postMessage("terminate");
        this.intervalWorker?.postMessage("terminate");

        const workerPrms = [this.reportWorker?.terminate(), this.intervalWorker?.terminate()];

        if (sdType === "graceful") {
            await Promise.all(workerPrms);
            while (this.runningActions.length !== 0) {
                await this.runningActions.pop();
            }
        }*/

        runDelProm.delayedResolve();
        console.log("[INFO] Daemon: Run context clean, stopping...");
    }
    //#endregion

    //#region Daemon controls
    public async start(): Promise<void> {
        if (this.runningProm !== null) {
            throw new Error("Unable to start: daemon already running");
        }

        console.log("[INFO] Daemon: Statistics processing daemon is booting up...");

        // TODO: Eventually throw a typed UnableToStartDaemonException or something similar...
        await this.readConfiguration(this.configFilePath);

        this.stopSignalProm = new DelayablePromise();

        this.run();
    }

    private async doShutdown(sdType: DaemonShutdownType): Promise<void> {
        if (this.runningProm === null) {
            throw new Error("Unable to shutdown: daemon not started");
        }

        console.log("[INFO] Daemon: Received daemon shutdown request");
        await this.stopSignalProm.delayedResolve(sdType);
        console.log("[INFO] Daemon: Daemon shutting down...");
        await this.runningProm;
        console.log("[INFO] Daemon: Daemon shutdown successful");

        await this.usedWorkQueue?.close();
        await this.usedRequestQueue?.close();
        await this.backedJobService?.shutdownJobService();

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
