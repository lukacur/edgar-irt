import { AbstractIRTDriver } from "./ApplicationModel/Driver/AbstractIRTDriver.js";
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
        private readonly statProcessor: AbstractStatisticsProcessor
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

    public startIRTService(): ConfiguredIRTService<TItem> {
        if (this.wasShutdown) {
            throw new IRTServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        return this;
    }

    public async shutdownIRTService(forceAfterSeconds?: number): Promise<void> {
        if (this.wasShutdown) {
            return;
        }
        
        await Promise.all(this.shutdownHooks.map(sh => sh("PRE_SHUTDOWN")));

        await Promise.all(this.shutdownHooks.map(sh => sh("POST_SHUTDOWN")));

        IRTService.shutdownUnconfigure();
        this.wasShutdown = true;
    }
}

class IRTServiceConfigurer<TItem extends IItem> {
    private driver?: AbstractIRTDriver<TItem>;
    private statisticsProcessor?: AbstractStatisticsProcessor;

    public useDriver(driver: AbstractIRTDriver<TItem>): IRTServiceConfigurer<TItem> {
        this.driver = driver;
        return this;
    }

    public useStatisticsProcessor(statProcessor: AbstractStatisticsProcessor): IRTServiceConfigurer<TItem> {
        this.statisticsProcessor = statProcessor;
        return this;
    }

    public build(): ConfiguredIRTService<TItem> {
        if (this.driver === undefined || this.statisticsProcessor === undefined) {
            throw new IRTServiceConfigurationException(
                "Service not properly configured. Missing driver or statistics processor"
            );
        }

        IRTService.setConfigured();

        return new ConfiguredIRTService<TItem>(this.driver, this.statisticsProcessor);
    }
}

export class IRTService {
    private static configured: boolean = false;

    private constructor() {}

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
