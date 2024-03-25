import { IInputDataExtractor } from "./ApplicationModel/Jobs/DataExtractors/IInputDataExtractor.js";
import { IJobProvider } from "./ApplicationModel/Jobs/Providers/IJobProvider.js";
import { IWorkResultPersistor } from "./ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { IJobWorker } from "./ApplicationModel/Jobs/Workers/IJobWorker.js";
import { JobServiceConfigurationException } from "./Exceptions/JobServiceConfigurationException.js";
import { JobRunner } from "./JobRunner.js";

class JobServiceInitializer {
    constructor(private readonly service: ConfiguredJobService) {}

    public apply(): ConfiguredJobService {
        return this.service;
    }
}

export type ShutdownHookState = "PRE_SHUTDOWN" | "SHUTDOWN" | "POST_SHUTDOWN";
export type ShutdownHook = (state: ShutdownHookState) => Promise<void>;

class ConfiguredJobService {
    private wasShutdown: boolean = false;

    private readonly shutdownHooks: ShutdownHook[] = [];

    constructor(
        private readonly jobProvider: IJobProvider,
        private readonly dataExtractor: IInputDataExtractor,
        private readonly jobWorker: IJobWorker,
        private readonly jobWorkResultPersistor: IWorkResultPersistor,
    ) {}

    public initialize(): JobServiceInitializer {
        if (this.wasShutdown) {
            throw new JobServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        return new JobServiceInitializer(this);
    }

    public addShutdownHook(hook: ShutdownHook): ConfiguredJobService {
        if (this.wasShutdown) {
            throw new JobServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        this.shutdownHooks.push(hook);
        return this;
    }

    private static readonly CONTROL_TOKEN = "a09088b8a4c039f7b9a89fbd007d93db49fa281928c7b690189c85bd2107c094";
    public static isValidControlToken(token: string): boolean {
        return token === ConfiguredJobService.CONTROL_TOKEN;
    }

    private jobRunner: JobRunner | null = null;

    public startJobService(): ConfiguredJobService {
        if (this.wasShutdown) {
            throw new JobServiceConfigurationException(
                "Instance of this service was shutdown. Create a new instance using the IRTService.configure method"
            );
        }

        this.jobRunner = new JobRunner(
            this.jobProvider,
            this.dataExtractor,
            this.jobWorker,
            this.jobWorkResultPersistor,
        );

        /*masterRunner.registerDriver(this.driver);
        masterRunner.registerStatisticsProcessor(this.statProcessor);
        masterRunner.registerParameterGenerator(this.parameterGenerator);*/

        // masterRunner.start(ConfiguredJobService.CONTROL_TOKEN);

        this.jobRunner.start();

        return this;
    }

    public async shutdownJobService(): Promise<void> {
        if (this.wasShutdown) {
            return;
        }

        await Promise.all(this.shutdownHooks.map(sh => sh("PRE_SHUTDOWN")));
        
        await this.jobRunner?.stop(true);
        const prom = Promise.all(this.shutdownHooks.map(sh => sh("SHUTDOWN")));
        await prom;

        await Promise.all(this.shutdownHooks.map(sh => sh("POST_SHUTDOWN")));

        this.wasShutdown = true;
    }
}

class JobServiceConfigurer {
    private jobProvider?: IJobProvider;
    private dataExtractor?: IInputDataExtractor;
    private jobWorker?: IJobWorker;
    private jobWorkResultPersistor?: IWorkResultPersistor;

    public useProvider(provider: IJobProvider): JobServiceConfigurer {
        this.jobProvider = provider;
        return this;
    }

    public useDataExtractor(dataExtractor: IInputDataExtractor): JobServiceConfigurer {
        this.dataExtractor = dataExtractor;
        return this;
    }

    public useWorker(jobWorker: IJobWorker): JobServiceConfigurer {
        this.jobWorker = jobWorker;
        return this;
    }

    public useWorkResultPersistor(jobWorkResultPersistor: IWorkResultPersistor): JobServiceConfigurer {
        this.jobWorkResultPersistor = jobWorkResultPersistor;
        return this;
    }

    private preBuildCheckPassed(): boolean {
        return this.jobProvider !== undefined &&
            this.dataExtractor !== undefined &&
            this.jobWorker !== undefined &&
            this.jobWorkResultPersistor !== undefined;
    }

    public build(): ConfiguredJobService {
        if (!this.preBuildCheckPassed()) {
            throw new JobServiceConfigurationException("Service not properly configured.");
        }

        return new ConfiguredJobService(
            this.jobProvider!,
            this.dataExtractor!,
            this.jobWorker!,
            this.jobWorkResultPersistor!
        );
    }
}

export class JobService {
    private constructor() {}

    public static isValidControlToken(token?: string) {
        return ConfiguredJobService.isValidControlToken(token ?? "");
    }

    public static configureNew(): JobServiceConfigurer {
        return new JobServiceConfigurer();
    }
}
