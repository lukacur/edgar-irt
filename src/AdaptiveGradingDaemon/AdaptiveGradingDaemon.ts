import { Worker } from "worker_threads";
import { DelayablePromise } from "../Util/DelayablePromise.js";
import { DaemonConfig, DaemonOptions } from "./DaemonConfig.model.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

type ForceShutdownHandler<TSource> = (source: TSource, reason?: string) => void;

type DaemonShutdownType = "forced" | "graceful";

export class AdaptiveGradingDaemon {
    private static readonly DEFAULT_OPTIONS: DaemonOptions = {
        waitForActionCompletion: true,
        actionProgress: { reportActionProgress: false, noReports: 0 },
    };

    private configuration: DaemonConfig | null = null;

    private async setupConfiguration(configFilePath: string): Promise<void> {
        if (!fs.existsSync(configFilePath)) {
            throw new Error(`File not found: ${configFilePath}`);
        }

        const prm = new DelayablePromise<string>();

        fs.readFile(
            configFilePath,
            {
                encoding: "utf-8",
            },
            (err, data) => (err) ? prm.delayedReject(err) : prm.delayedResolve(data)
        );

        this.configuration = JSON.parse(await prm.getWrappedPromise());
        if (this.configuration === null || !("scanInterval" in this.configuration)) {
            throw new Error(`Unable to parse given configuration file at: ${configFilePath}`);
        }
    }

    constructor(
        private readonly configFilePath: string,
        private readonly intervalledAction: () => void | Promise<void>,
        private readonly options: DaemonOptions = AdaptiveGradingDaemon.DEFAULT_OPTIONS,
        private readonly forceShutdownHandler?: ForceShutdownHandler<AdaptiveGradingDaemon>
    ) {}

    private stopSignalProm = new DelayablePromise<DaemonShutdownType>();
    private intervalClearedProm: Promise<void> | null = null;

    private getIntervalMillis(): number {
        if (!this.configuration) {
            throw new Error("Daemon not correctly configured");
        }

        const scanInter = this.configuration.scanInterval;

        return (
            (scanInter.days ?? 0) * (24 * 3600 * 1000) +
            (scanInter.hours ?? 0) * (3600 * 1000) +
            (scanInter.minutes ?? 0) * (60 * 1000) +
            (scanInter.seconds ?? 0) * (1000)
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

    private async run(): Promise<void> {
        const intClrd = new DelayablePromise<void>();
        this.intervalClearedProm = intClrd.getWrappedPromise();

        if (this.options.actionProgress.reportActionProgress) {
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
        }

        intClrd.delayedResolve();
    }
    //#endregion

    //#region Daemon controls
    public async start(): Promise<void> {
        if (this.intervalClearedProm !== null) {
            throw new Error("Unable to start: daemon already running");
        }

        // TODO: Eventually throw a typed UnableToStartDaemonException or something similar...
        await this.setupConfiguration(this.configFilePath);

        this.stopSignalProm = new DelayablePromise();

        this.run();
    }

    private async doShutdown(sdType: DaemonShutdownType): Promise<void> {
        if (this.intervalClearedProm === null) {
            throw new Error("Unable to shutdown: daemon not started");
        }

        await this.stopSignalProm.delayedResolve(sdType);
        await this.intervalClearedProm;
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
