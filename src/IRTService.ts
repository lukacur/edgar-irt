import { AbstractIRTDriver } from "./ApplicationModel/Driver/AbstractIRTDriver.js";
import { IParameterGenerator } from "./ApplicationModel/ParameterGeneration/IParameterGenerator.js";
import { MasterRunner } from "./ApplicationModel/Runner/MasterRunner.js";
import { AbstractStatisticsProcessor } from "./ApplicationModel/StatisticsProcessor/AbstractStatisticsProcessor.js";
import { IRTServiceConfigurationException } from "./Exceptions/IRTServiceConfigurationException.js";
import { IItem } from "./IRT/Item/IItem.js";

class IRTServiceInitializer<TItem extends IItem> {
    constructor(private readonly service: ConfiguredIRTService<TItem>) {}

    public apply(): ConfiguredIRTService<TItem> {
        return this.service;
    }
}

export type ShutdownHookState = "PRE_SHUTDOWN" | "SHUTDOWN" | "POST_SHUTDOWN";
export type ShutdownHook = (state: ShutdownHookState) => Promise<void>;

class ConfiguredIRTService<TItem extends IItem> {
    private wasShutdown: boolean = false;

    private readonly shutdownHooks: ShutdownHook[] = [];

    constructor(
        private readonly driver: AbstractIRTDriver<TItem>,
        private readonly statProcessor: AbstractStatisticsProcessor,
        private readonly parameterGenerator: IParameterGenerator,
    ) {}

    public initialize(): IRTServiceInitializer<TItem> {
        if (this.wasShutdown) {
            throw new IRTServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        return new IRTServiceInitializer(this);
    }

    public addShutdownHook(hook: ShutdownHook): ConfiguredIRTService<TItem> {
        if (this.wasShutdown) {
            throw new IRTServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        this.shutdownHooks.push(hook);
        return this;
    }

    private static readonly CONTROL_TOKEN = "a09088b8a4c039f7b9a89fbd007d93db49fa281928c7b690189c85bd2107c094";
    public static isValidControlToken(token: string): boolean {
        return token === ConfiguredIRTService.CONTROL_TOKEN;
    }

    public startIRTService(): ConfiguredIRTService<TItem> {
        if (this.wasShutdown) {
            throw new IRTServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        const masterRunner = MasterRunner.instance;

        masterRunner.registerDriver(this.driver);
        masterRunner.registerStatisticsProcessor(this.statProcessor);
        masterRunner.registerParameterGenerator(this.parameterGenerator);

        masterRunner.start(ConfiguredIRTService.CONTROL_TOKEN);

        return this;
    }

    public async shutdownIRTService(): Promise<void> {
        if (this.wasShutdown) {
            return;
        }

        await Promise.all(this.shutdownHooks.map(sh => sh("PRE_SHUTDOWN")));
        
        const prom = Promise.all(this.shutdownHooks.map(sh => sh("SHUTDOWN")));
        await MasterRunner.instance.stop(ConfiguredIRTService.CONTROL_TOKEN);
        await prom;

        await Promise.all(this.shutdownHooks.map(sh => sh("POST_SHUTDOWN")));

        IRTService.shutdownUnconfigure();
        this.wasShutdown = true;
    }
}

class IRTServiceConfigurer<TItem extends IItem> {
    private driver?: AbstractIRTDriver<TItem>;
    private statisticsProcessor?: AbstractStatisticsProcessor;
    private parameterGenerator?: IParameterGenerator;

    public useDriver(driver: AbstractIRTDriver<TItem>): IRTServiceConfigurer<TItem> {
        this.driver = driver;
        return this;
    }

    public useStatisticsProcessor(statProcessor: AbstractStatisticsProcessor): IRTServiceConfigurer<TItem> {
        this.statisticsProcessor = statProcessor;
        return this;
    }

    public useParameterGenerator(parameterGenerator: IParameterGenerator): IRTServiceConfigurer<TItem> {
        this.parameterGenerator = parameterGenerator;
        return this;
    }

    private preBuildCheckPassed(): boolean {
        return this.driver !== undefined &&
            this.statisticsProcessor !== undefined &&
            this.parameterGenerator !== undefined;
    }

    public build(): ConfiguredIRTService<TItem> {
        if (!this.preBuildCheckPassed()) {
            throw new IRTServiceConfigurationException("Service not properly configured.");
        }

        IRTService.setConfigured();

        return new ConfiguredIRTService<TItem>(this.driver!, this.statisticsProcessor!, this.parameterGenerator!);
    }
}

export class IRTService {
    private static configured: boolean = false;

    private constructor() {}

    public static isValidControlToken(token?: string) {
        return ConfiguredIRTService.isValidControlToken(token ?? "");
    }

    static setConfigured(): void {
        if (IRTService.configured) {
            throw new IRTServiceConfigurationException("Service was already configured");
        }

        IRTService.configured = true;
    }

    static shutdownUnconfigure(): void {
        IRTService.configured = false;
    }

    public static configure<TItem extends IItem>(): IRTServiceConfigurer<TItem> {
        if (IRTService.configured) {
            throw new IRTServiceConfigurationException("Service was already configured");
        }

        return new IRTServiceConfigurer();
    }
}
