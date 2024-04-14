import { Worker } from "worker_threads";
import { DelayablePromise } from "../Util/DelayablePromise.js";
import { DaemonConfig, DaemonOptions, QueueDescriptor } from "./DaemonConfig.model.js";
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

type ForceShutdownHandler<TSource> = (source: TSource, reason?: string) => void;

type DaemonShutdownType = "forced" | "graceful";

export class AdaptiveGradingDaemon {
    private static readonly DEFAULT_OPTIONS: DaemonOptions = {
        waitForActionCompletion: true,
        actionProgress: { reportActionProgress: false, noReports: 0 },
    };

    private configuration: DaemonConfig | null = null;

    private usedRequestQueue: IQueueSystemBase<CourseStatisticsProcessingRequest> | null = null;
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

        this.usedRequestQueue = AdaptiveGradingDaemon.setupQueue(configuration.incomingWorkRequestQueue);
        this.usedWorkQueue = AdaptiveGradingDaemon.setupQueue(configuration.jobRunnerWorkingQueue);

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

    private getIntervalMillis(): number {
        if (this.configuration === null) {
            throw new Error("Daemon not correctly configured");
        }

        return (
            (this.configuration.scanInterval.days ?? 0) * (24 * 3600 * 1000) +
            (this.configuration.scanInterval.hours ?? 0) * (3600 * 1000) +
            (this.configuration.scanInterval.minutes ?? 0) * (60 * 1000) +
            (this.configuration.scanInterval.seconds ?? 0) * (1000)
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
        this.reportWorker = new Worker(
            path.join(fileURLToPath(import.meta.url), "..", "DaemonProgressReportWorker.js"),
            {
                workerData: {
                    intervalMillis: this.getIntervalMillis(),
                    noReports: this.options.actionProgress.noReports,
                }
            }
        );
    }

    private intervalWorker: Worker | null = null;

    private startIntervalWorker(): void {
        this.intervalWorker = new Worker(
            path.join(fileURLToPath(import.meta.url), "..", "DaemonIntervalWorker.js"),
            {
                workerData: {
                    intervalMillis: this.getIntervalMillis(),
                }
            }
        );
    }

    private static readonly defaultMaxJobTimeout = 200000;
    private backedJobService: IConfiguredJobService | null = null;

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

        while (!this.stopSignalProm.isFinished()) {
            const req = await this.usedRequestQueue.dequeue();

            await this.usedWorkQueue.enqueue(
                await EdgarStatProcJobConfiguration.fromStatisticsProcessingRequest(
                    req,
                    this.configuration.scanInterval,
                    this.configuration.calculationConfig,
                    this.usedWorkQueue.queueName,
                    `Statistics calculation job for course with ID '${req.idCourse}' ` +
                        `started @ '${new Date().toISOString()}'`,
                    this.configuration.maxJobTimeoutMs ?? AdaptiveGradingDaemon.defaultMaxJobTimeout,
                )
            );
        }

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
    }
    //#endregion

    //#region Daemon controls
    public async start(): Promise<void> {
        if (this.runningProm !== null) {
            throw new Error("Unable to start: daemon already running");
        }

        // TODO: Eventually throw a typed UnableToStartDaemonException or something similar...
        await this.readConfiguration(this.configFilePath);

        this.stopSignalProm = new DelayablePromise();

        this.run();
    }

    private async doShutdown(sdType: DaemonShutdownType): Promise<void> {
        if (this.runningProm === null) {
            throw new Error("Unable to shutdown: daemon not started");
        }

        await this.stopSignalProm.delayedResolve(sdType);
        await this.runningProm;
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
