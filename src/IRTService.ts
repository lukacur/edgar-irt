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
    private readonly shutdownHooks: ShutdownHook[] = [];

    constructor(
        private readonly driver: AbstractIRTDriver<TItem>,
        private readonly statProcessor: AbstractStatisticsProcessor
    ) {}

    public initialize(): IRTServiceInitializer<TItem> {
        return new IRTServiceInitializer(this);
    }

    public addShutdownHook(hook: ShutdownHook): ConfiguredIRTService<TItem> {
        this.shutdownHooks.push(hook);
        return this;
    }

    public startIRTService(): ConfiguredIRTService<TItem> {
        return this;
    }

    public async shutdownIRTService(forceAfterSeconds?: number): Promise<void> {
        await Promise.all(this.shutdownHooks.map(sh => sh("PRE_SHUTDOWN")));
        
        await Promise.all(this.shutdownHooks.map(sh => sh("POST_SHUTDOWN")));
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

        return new ConfiguredIRTService<TItem>(this.driver, this.statisticsProcessor);
    }
}

export class IRTService {
    private constructor() {}

    public static configure<TItem extends IItem>(): IRTServiceConfigurer<TItem> {
        return new IRTServiceConfigurer();
    }
}
