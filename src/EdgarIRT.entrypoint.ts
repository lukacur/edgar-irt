import { execFile } from "child_process";
import { AdaptiveGradingDaemon } from "./AdaptiveGradingDaemon/AdaptiveGradingDaemon.js";
import { DatabaseConnection } from "./ApplicationImplementation/Database/DatabaseConnection.js";
import { AbstractLogisticFunctionParams } from "./IRT/LogisticFunction/LogisticFunctionTypes.js";
import { StandardLogisticFunction } from "./IRT/LogisticFunction/StandardLogisticFunction.js";
import { DelayablePromise } from "./Util/DelayablePromise.js";
import { CourseBasedBatch } from "./ApplicationImplementation/Edgar/Batches/CourseBasedBatch.js";
import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from "fs";
import { IQueueSystemBase } from "./AdaptiveGradingDaemon/Queue/IQueueSystemBase.js";
import { FileQueueSystem } from "./AdaptiveGradingDaemon/Queue/QueueSystemImplementations/FileQueueSystem.js";
import { DirQueueSystem } from "./AdaptiveGradingDaemon/Queue/QueueSystemImplementations/DirQueueSystem.js";
import { PgBossQueueSystem } from "./AdaptiveGradingDaemon/Queue/QueueSystemImplementations/PgBossQueueSystem.js";
import { CourseStatisticsCalculationQueue, CourseStatisticsProcessingRequest } from "./AdaptiveGradingDaemon/Queue/StatisticsCalculationQueues/CourseStatisticsCalculationQueue.js";
import { EdgarStatProcJobProvider } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobProvider.js";
import { EdgarStatProcDataExtractor } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/DataExtractor/EdgarStatProcDataExtractor.js";
import { EdgarStatProcWorker } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Worker/EdgarStatProcWorker.js";
import { EdgarStatProcWorkResultPersistor } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/WorkResultPersistor/EdgarStatProcWorkResultPersistor.js";
import { EdgarStatProcJobStep } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/StatisticsProcessing/EdgarStatProcJobStep.js";
import { EdgarStatProcStepConfiguration } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/StatisticsProcessing/EdgarStatProcStepConfiguration.js";
import { JobService } from "./JobService.js";
import { CheckIfCalculationNeededStep } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/CheckIfCalculationNeeded/CheckIfCalculationNeededStep.js";
import { CheckIfCalculationNeededStepConfiguration } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Steps/CheckIfCalculationNeeded/CheckIfCalculationNeededStepConfiguration.js";
import { randomUUID } from "crypto";
import { EdgarStatProcJobConfiguration } from "./ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/Provider/EdgarStatProcJobConfiguration.js";
import { EdgarStatsProcessingConstants } from "./ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { RegisterDelegateToRegistry } from "./ApplicationModel/Decorators/Registration.decorator.js";
import { DatabaseConnectionRegistry } from "./PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { RegistryDefaultConstants } from "./PluginSupport/RegistryDefault.constants.js";
import { DynamicScriptImporter } from "./PluginSupport/DynamicScriptImporter.js";
import { PersistorRegistry } from "./PluginSupport/Registries/Implementation/PersistorRegistry.js";
import path from "path";
import { AbstractTypedWorkResultPersistor } from "./ApplicationModel/Jobs/WorkResultPersistors/AbstractTypedWorkResultPersistor.js";
import { fileURLToPath } from "url";
import { FrameworkConfigurationProvider } from "./ApplicationModel/FrameworkConfiguration/FrameworkConfigurationProvider.js";

type AvailableTests =
    "db" |
    "child_process" |
    "stats_processor" |
    "delayed_promise" |
    "daemon" |
    "service_setup" |
    "serialization" |
    "queue" |
    "job" |
    "total_job" |
    "generic_job" |
    "dynamic_imports";

export class MainRunner {
    private static async delayableAwaiter<T>(prom: DelayablePromise<T>) {
        await prom.getWrappedPromise();
        console.log("delayableAwaiter")
    }

    private static readonly DEFAULT_TIMEOUT_MS = 2000;

    private static async doChildProcTest(): Promise<void> {
        const delProm = new DelayablePromise<any>();
        const childProc = execFile(
            "Rscript",
            ['"test_script.r"', '--inFile', '"B:/testna/r/probni_irt.json"'],
            { shell: true, windowsHide: true },
            (err, scriptStdout, scriptStderr) => {
                if (err) {
                    delProm.delayedReject(err);
                    return;
                }

                delProm.delayedResolve((scriptStdout));
            }
        );

        const execTimeout = setTimeout(
            () => {
                childProc.kill("SIGINT");
                delProm.delayedReject("Calculation timed out");
            },
            MainRunner.DEFAULT_TIMEOUT_MS
        );

        try {
            const calcResult = await delProm.getWrappedPromise();
            clearTimeout(execTimeout);
    
            console.log(calcResult);
        } catch (err) {
            clearTimeout(execTimeout);
            console.log(err);
        }
    }

    private static async doStatsProcTest(dbConn: DatabaseConnection): Promise<void> {
        /*const statsProc = new EdgarRStatisticsProcessor(
            "test_script.r",
            "B:/testna/r/json_in.json",
            "irt",
            new CourseBasedBatch(
                dbConn,
                2,
                1,
                0
            ),
            MainRunner.DEFAULT_TIMEOUT_MS,
            "B:/testna/r/json_out.json",
        );

        const processingResult = await statsProc.process();
        console.log(processingResult);*/
    }

    private static async doDbTest(dbConn: DatabaseConnection): Promise<void> {
        const students = await dbConn.doQuery(
            `SELECT *
            FROM student
            WHERE id > $1`,
            [3]
        );

        if (students !== null) {
            console.log(students.count);
            console.log(students.rows.splice(0, 50));
            return;
        }

        console.log("Closing pooled connection...");
        await dbConn.close();
        console.log("Connection closed successfully");
    }

    private static async doSerializationTest(dbConn: DatabaseConnection): Promise<void> {
        const courseBasedBatchInfo = new CourseBasedBatch(
            dbConn,
            2006,
            2022,
            0
        );

        const courseObj = {};

        await courseBasedBatchInfo.serializeInto(courseObj);

        if (!existsSync("./tests_dir")) {
            await mkdir("./tests_dir");
        }

        await writeFile(
            "./tests_dir/test_serialization.json",
            JSON.stringify([courseObj], undefined, 4),
            { encoding: "utf-8" }
        );
    }

    private static daemonQueue: IQueueSystemBase<CourseStatisticsProcessingRequest> =
        new FileQueueSystem("FOO-QUEUE", "./queues/daemon/daemon-file-q.json")
        /*new class implements IQueueSystemBase<CourseStatisticsProcessingRequest> {
            queueName: string = "FOO-QUEUE";

            private readonly entries: CourseStatisticsProcessingRequest[] = [];

            public async enqueue(data: CourseStatisticsProcessingRequest): Promise<boolean> {
                this.entries.push(data);

                if (this.waitingForQueue.length !== 0) {
                    this.waitingForQueue.shift()!.delayedResolve(this.entries.shift()!);
                }

                return true;
            }

            private waitingForQueue: DelayablePromise<CourseStatisticsProcessingRequest>[] = [];

            public async dequeue(): Promise<CourseStatisticsProcessingRequest> {
                if (this.entries.length === 0) {
                    const prom = new DelayablePromise<CourseStatisticsProcessingRequest>();

                    this.waitingForQueue.push(prom);
                    return prom.getWrappedPromise();
                }

                return this.entries.shift()!;
            }

            public async peek(): Promise<CourseStatisticsProcessingRequest | null> {
                return this.entries[0] ?? null;
            }

            public async empty(): Promise<boolean> {
                this.entries.splice(0, this.entries.length);

                return true;
            }

            public async close(): Promise<void> {}
            
        };*/

    private static async doDaemonTest(args: string[]): Promise<void> {
        console.log("Passed arguments:");
        console.log(args);
        console.log("-----------------");

        const daemon = new AdaptiveGradingDaemon(
            "./adapGrading.config.json",
            () => console.log("Yea..."),
            { waitForActionCompletion: true, actionProgress: { reportActionProgress: true, noReports: 10 } },
            MainRunner.daemonQueue,
            (dmn, reason) => console.log(`This is a forced daemon shutdown: ${reason ?? ""}`)
        );

        let terminated = false;

        (async () => {
            await daemon.start();

            /*const prm = new DelayablePromise<void>();

            setTimeout(() => prm.delayedResolve(), 10000);

            await prm.getWrappedPromise();

            if (terminated) {
                return;
            }

            console.log("Shutting down adaptive grading daemon...");

            try {
                await daemon.shutdown();
                console.log("Adaptive grading daemon shutdown successful");
            } catch (err) {
                console.log("Unable to shutdown adaptive grading daemon. Reason:");
                console.log(err);
            }*/
        })();

        await MainRunner.daemonQueue.enqueue({
            forceCalculation: false,
            idCourse: 2006,
            idStartAcademicYear: 2022,
            numberOfIncludedPreviousYears: 0,
            userRequested: null,
        });

        const prm = new DelayablePromise<void>();

        setTimeout(
            async () => {
                await daemon.shutdown();
                await prm.delayedResolve();
            },
            200000
        );

        process.on("SIGTERM", (sig) => {
            terminated = true;
            daemon.forceShutdown("Terminated by user");
            process.exit(0);
        });

        process.on("SIGINT", async (sig) => {
            terminated = true;

            try {
                await daemon.shutdown();
                console.log("Adaptive grading daemon shutdown successful (SIGINT)");
            } catch (err) {
                console.log("Unable to shutdown adaptive grading daemon. Reason:");
                console.log(err);
            } finally {
                process.exit(0);
            }
        });

        await prm.getWrappedPromise();
    }

    private static async doDelayedPromiseTest(): Promise<void> {
        const logFn = new StandardLogisticFunction(1, AbstractLogisticFunctionParams.createParams(0.65, 0.40, 0.20, 0.95));

        console.log(logFn.apply(5.5));

        const delayedPromise: DelayablePromise<boolean> = new DelayablePromise();
        MainRunner.delayableAwaiter(delayedPromise);

        setTimeout(() => {
            console.log("Timeout");
            delayedPromise.delayedResolve(true);
        }, 2000);

        delayedPromise.getWrappedPromise().then(() => {
            console.log("Main");
        });
    }

    /*private static async doServiceSetupTest(): Promise<void> {
        const service = IRTService.configure()
            .useDriver(new QueryDriver()) // set the driver to be used to generate batches of items for which to calculate IRT parameters (for example an HTTP REST IRT driver, file IRT driver etc.)
            .useParameterGenerator(new TempParamGenerator()) // the parameter generator to use (the generator that will use values calculated by the stats. processor to generate IRT parameters)
            .useStatisticsProcessor(new EdgarRStatisticsProcessor(
                "test_script.r",
                "B:/testna/r/json_in.json",
                "irt",
                null,
                MainRunner.DEFAULT_TIMEOUT_MS,
                "B:/testna/r/json_out.json",
            )) // the prototype statistics processor to use (for example Rlang stats processor, native stats processor, python stats processor etc.)
            .build()
                .initialize()
                    // ... do some initialization (like environment setup etc.)
                    .apply()
                .addShutdownHook(
                    (st) =>
                        new Promise((resolve, reject) => {
                            console.log(`Shutdown is in state: ${st}`);
                            resolve();
                        })
                );
        service.startIRTService();

        setTimeout(async () => await service.shutdownIRTService(), 3000);
    }*/

    private static async doQueueTests() {
        type TestDataType = { id: number, content: string };

        const queueData: TestDataType = { id: 232, content: "This is a test!" };

        const queues: IQueueSystemBase<TestDataType>[] = [];

        queues.push(
            new FileQueueSystem(
                "test-file-queue",
                "./queues/file/json-file-queue.queue.json"
            )
        );

        let queuingSuffix = 0;
        queues.push(
            new DirQueueSystem(
                "test-dir-queue",
                "./queues/directory-queue",
                { prefix: "test_", name: "queueing", suffixProvider: () => (++queuingSuffix).toString() }
            )
        );

        queues.push(
            new PgBossQueueSystem(
                "postgres://postgres:bazepodataka@127.0.0.1:5433/boss_test",
                "test-queue"
            )
        );

        for (const queue of queues) {
            await queue.empty();

            console.log("Enqueing...");
            await queue.enqueue(queueData);
        }

        for (const queue of queues) {
            const elem = await queue.peek();

            if (elem === null || elem.id !== queueData.id || elem.content !== queueData.content) {
                console.log(queue);
                throw new Error("Queue not working properly");
            }
        }

        for (const queue of queues) {
            console.log("Dequeing...");
            const elem = await queue.dequeue();

            if (elem.id !== queueData.id || elem.content !== queueData.content) {
                console.log(queue);
                throw new Error("Queue not working properly");
            }
        }

        for (const queue of queues) {
            console.log("Peeking...");
            if (await queue.peek() !== null) {
                console.log(queue);
                throw new Error("Queue not working properly");
            }
        }

        for (const queue of queues) {
            console.log("Enqueing...");
            await queue.enqueue(queueData);
        }

        for (const queue of queues) {
            console.log("Emptying...");
            const emptied = await queue.empty();

            if (!emptied) {
                console.log(queue);
                throw new Error("Queue not working properly");
            }
        }

        for (const queue of queues) {
            console.log("Peeking...");
            if (await queue.peek() !== null) {
                console.log(queue);
                throw new Error("Queue not working properly");
            }
        }

        let cnt = 0;
        for (const queue of queues) {
            setTimeout(
                () => queue.enqueue(queueData),
                2500 * (++cnt)
            );
        }

        for (const queue of queues) {
            console.log("Dequeing empty...");
            const elem = await queue.dequeue();

            if (elem.id !== queueData.id || elem.content !== queueData.content) {
                console.log(queue);
                throw new Error("Queue not working properly");
            }
        }

        for (const queue of queues) {
            console.log("Enqueing...");
            await queue.enqueue(queueData);
        }

        for (const queue of queues) {
            console.log("Closing...");
            await queue.close();
        }

        console.log("Done!");
    }

    public static async doJobsTest(dbConn: DatabaseConnection): Promise<void> {
        const calcQueue = new CourseStatisticsCalculationQueue(
            "",
            new FileQueueSystem(
                "test-file-queue",
                "./queues/file/json-file-queue.queue.json"
            ),
        );

        const jobProvider = new EdgarStatProcJobProvider(
            dbConn,
            calcQueue,
            200000,

            [new EdgarStatProcJobStep(
                200000,
                new EdgarStatProcStepConfiguration(
                    "./test_script.r",
                    "./tests_dir/test_serialization.json",
                    "./tests_dir/output/serialization_output.json",
                )
            )]
        );
        const dataExtractor = new EdgarStatProcDataExtractor();
        const jobWorker = new EdgarStatProcWorker(dbConn);
        const resultPersistor = new EdgarStatProcWorkResultPersistor(dbConn);

        await calcQueue.enqueue(
            new EdgarStatProcJobConfiguration(
                randomUUID(),
                "Test job - total job test",
                null,
                "",
                200000,
                {
                    type: "",
                    configContent: new CourseBasedBatch(
                        dbConn,
                        2006,
                        2022,
                        0,
                    )
                },
                {
                    type: "",
                    databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                    steps: []
                },
                {
                    type: "",
                    persistanceTimeoutMs: 50000,
                    configContent: {}
                },
                {
                    awaitDataExtraction: true,
                    persistResultInBackground: false,
                    workInBackground: false
                }
            )
        );

        const jobConfig = await jobProvider.provideJob();
        let success;

        const data = await dataExtractor.formatJobInput(jobConfig);
        success = await jobWorker.startExecution(jobConfig, data);

        if (!success) {
            await jobProvider.failJob(jobConfig.jobId, "retry");
            throw new Error("Processing error occurred");
        }

        while (jobWorker.hasNextStep()) {
            if (!(await jobWorker.executeNextStep())) {
                await jobProvider.failJob(jobConfig.jobId, "retry");
                throw new Error("Step-by-step execution error occurred");
            }
        }

        const result = await jobWorker.getExecutionResult();

        if (result === null) {
            await jobProvider.failJob(jobConfig.jobId, "no-retry");
            throw new Error("Unable to calculate: script call failed");
        }

        let retry = 3;
        success = false;

        while (retry > 0 && !success) {
            success = await resultPersistor.perisistResult(result, jobConfig);
            --retry;
        }

        if (!success) {
            await jobProvider.failJob(jobConfig.jobId, "no-retry");
            throw new Error("Calculation unsuccessful");
        }

        await jobProvider.finishJob(jobConfig.jobId);

        console.log("Calculation successful!");

        return;
    }

    public static async doTotalJobTest(dbConn: DatabaseConnection): Promise<void> {
        const calcQueue = new CourseStatisticsCalculationQueue(
            "",
            new FileQueueSystem(
                "test-file-queue",
                "./queues/file/json-file-queue.queue.json"
            ),
        );
        await calcQueue.enqueue(
            new EdgarStatProcJobConfiguration(
                randomUUID(),
                "Test job - total job test",
                null,
                "",
                200000,
                {
                    type: "",
                    configContent: new CourseBasedBatch(
                        dbConn,
                        2006,
                        2022,
                        0,
                    )
                },
                {
                    type: "",
                    databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                    steps: []
                },
                {
                    type: "",
                    persistanceTimeoutMs: 50000,
                    configContent: {}
                },
                {
                    awaitDataExtraction: true,
                    persistResultInBackground: false,
                    workInBackground: false
                }
            )
        );

        const jobProvider = new EdgarStatProcJobProvider(
            dbConn,
            calcQueue,
            200000,

            [
                new CheckIfCalculationNeededStep(
                    5000,
                    new CheckIfCalculationNeededStepConfiguration(
                        { days: 30 },
                        false,
                        RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                    ),
                    dbConn,
                    true,
                ),
                new EdgarStatProcJobStep(
                    200000,
                    new EdgarStatProcStepConfiguration(
                        "./test_script.r",
                        "./tests_dir/test_serialization.json",
                        "./tests_dir/output/serialization_output.json",
                    )
                )
            ]
        );
        const dataExtractor = new EdgarStatProcDataExtractor();
        const jobWorker = new EdgarStatProcWorker(dbConn);
        const resultPersistor = new EdgarStatProcWorkResultPersistor(dbConn);

        const jobService = JobService.configureNew()
            .useProvider(jobProvider)
            .useDataExtractor(dataExtractor)
            .useWorker(jobWorker)
            .useWorkResultPersistor(resultPersistor)
            .build();
        
        jobService.startJobService();

        return jobService.shutdownJobService();
    }

    public static async doGenericJobTest(dbConn: DatabaseConnection): Promise<void> {
        const calcQueue = new CourseStatisticsCalculationQueue(
            "",
            new FileQueueSystem(
                "test-file-queue",
                "./queues/file/json-file-queue.queue.json"
            ),
        );

        await calcQueue.enqueue(
            /*{
                jobId: randomUUID(),
                jobName: "Test job - total job test for course statistics calculation",
                idUserStarted: null,
                jobQueue: "",
                jobTimeoutMs: 200000,

                blockingConfig: {
                    awaitDataExtraction: true,
                    persistResultInBackground: false,
                    workInBackground: false,
                },

                inputExtractorConfig: {
                    type: EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY,
                    configContent: {
                        databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                        idCourse: 2006,
                        idStartAcademicYear: 2022,
                        numberOfIncludedPreviousYears: 0,
                    },
                },

                jobWorkerConfig: {
                    type: EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY,
                    steps: [
                        {
                            type: EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY,
                            stepTimeoutMs: 20000,
                            configContent: {
                                databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                                calculationsValidFor: {
                                    days: 30,
                                    hours: 0,
                                    minutes: 0,
                                    seconds: 0
                                },
                                forceCalculation: false,
                            },
                        },
                        {
                            type: EdgarStatsProcessingConstants.STATISTICS_CALCULATION_STEP_ENTRY,
                            stepTimeoutMs: 200000,
                            configContent: {
                                databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                                calculationScriptAbsPath: "./test_script.r",
                                inputJSONInfoAbsPath: "./tests_dir/test_serialization.json",
                                outputFile: "./tests_dir/output/serialization_output.json",
                            },
                        }
                    ]
                },

                dataPersistorConfig: {
                    type: EdgarStatsProcessingConstants.PERSISTOR_ENTRY,
                    persistanceTimeoutMs: 100000,
                    configContent: {
                        databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                    },
                },
            },*/

            JSON.parse(
                `{
                    "jobId": "aa7cd-1584bbf-2283-ccbcdffa55301",
                    "jobTypeAbbrevation": "STATPROC",
                    "jobName": "Process question statistics for course 'Objektno orijentirano programiranje' in academic years 2018-2024",
                    "idUserStarted": null,
                    "jobQueue": "edgar-question-statistics-processing",
                    "jobTimeoutMs": 250000,
                
                    "blockingConfig": {
                        "awaitDataExtraction": true,
                        "workInBackground": false,
                        "persistResultInBackground": false
                    },
                
                    "inputExtractorConfig": {
                        "type": "${EdgarStatsProcessingConstants.DATA_EXTRACTOR_REGISTRY_ENTRY}",
                        "configContent": {
                            "databaseConnection": "${RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY}",
                            "idCourse": 2006,
                            "idStartAcademicYear": 2022,
                            "numberOfIncludedPreviousYears": 0
                        }
                    },
                
                    "jobWorkerConfig": {
                        "type": "${EdgarStatsProcessingConstants.JOB_WORKER_REGISTRY_ENTRY}",
                        "databaseConnection": "${RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY}",
                        "steps": [
                            {
                                "type": "${EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY}",
                                "stepTimeoutMs": 5000,
                                "configContent": {
                                    "databaseConnection": "${RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY}",
                                    "calculationsValidFor": {
                                        "days": 2,
                                        "hours": 15,
                                        "minutes": 1,
                                        "seconds": 10
                                    },
                                    "forceCalculation": false
                                }
                            },
                            {
                                "type": "${EdgarStatsProcessingConstants.STATISTICS_CALCULATION_STEP_ENTRY}",
                                "stepTimeoutMs": 200000,
                                "configContent": {
                                    "databaseConnection": "${RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY}",
                                    "calculationScriptAbsPath": "./test_script.r",
                                    "inputJSONInfoAbsPath": "./tests_dir/test_serialization.json",
                                    "outputFile": "./tests_dir/output/serialization_output.json"
                                },
                                "constructWithJobInfo": false
                            }
                        ]
                    },
                
                    "dataPersistorConfig": {
                        "type": "${EdgarStatsProcessingConstants.DATA_PERSISTOR_REGISTRY_ENTRY}",
                        "persistanceTimeoutMs": 100000,
                        "configContent": {
                            "databaseConnection": "${RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY}"
                        }
                    }
                }`
            )
        );

        const jobProvider = new EdgarStatProcJobProvider(
            dbConn,
            calcQueue,
            200000,
            []
        );

        const jobService = JobService.configureNew()
            .useProvider(jobProvider)
            .build();
        
        jobService.startJobService();

        return jobService.shutdownJobService();
    }

    private static async doDynamicImportsTest(): Promise<void> {
        const data = await DynamicScriptImporter.importScript<AbstractTypedWorkResultPersistor<any, any>>({
            url: path.join(fileURLToPath(import.meta.url), "..", "./ExamplePersistorPluginScript.js")
        });
        const fooTypeInst = new data.type();

        if (!(fooTypeInst instanceof AbstractTypedWorkResultPersistor)) {
            throw new Error("Invalid type!");
        }

        console.log(fooTypeInst);

        console.log(
            DatabaseConnectionRegistry.instance.getItem("example_connection")
        );

        console.log(
            PersistorRegistry.instance.getItem("example_persistor")
        );

        (data.teardown !== undefined && typeof(data.teardown) === "function") ? await data.teardown() : null;
    }

    /*private static defaultConnection: DatabaseConnection | null;

    @RegisterDelegateToRegistry(
        "DatabaseConnection",
        RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
    )
    private createDefaultConnection(...args: any[]): object {
        if (MainRunner.defaultConnection === null) {
            throw new Error("Default connection was not set up");
        }

        return MainRunner.defaultConnection;
    }*/

    private static readonly CURRENT_TEST: AvailableTests = "daemon";

    public static async main(args: string[]): Promise<void> {
        // MainRunner.defaultConnection = await DatabaseConnection.fromConfigFile("./database-config.json");
        FrameworkConfigurationProvider.instance.useConfiguration({
            databaseConnectivity: {
                connectionConfiguration: JSON.parse(
                    await readFile("./database-config.json", { encoding: "utf-8" })
                ),
                jobSchemaName: "job_tracking_schema",
            },
            smtpConfiguration: {
                always: {},
                credentials: {certificateBase64: ""},
                defaults: {from: "foo", subject: "Foo", to: []},
                host: "",
                port: 0,
                timeoutMs: 10000,
                useTls: true,
            }
        });

        await FrameworkConfigurationProvider.instance.registerDefaultConnectionProvider();

        const conn = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );

        let prom: Promise<void>;

        switch (MainRunner.CURRENT_TEST) {
            case "db": {
                prom = MainRunner.doDbTest(conn);
                break;
            }

            case "child_process": {
                prom = MainRunner.doChildProcTest();
                break;
            }

            case "stats_processor": {
                prom = MainRunner.doStatsProcTest(conn);
                break;
            }

            case "delayed_promise": {
                prom = MainRunner.doDelayedPromiseTest();
                break;
            }

            case "serialization": {
                prom = MainRunner.doSerializationTest(conn);
                break;
            }

            case "daemon": {
                prom = MainRunner.doDaemonTest(args);
                break;
            }

            case "service_setup": {
                prom = Promise.resolve(); // MainRunner.doServiceSetupTest();
                break;
            }

            case "queue": {
                prom = MainRunner.doQueueTests();
                break;
            }

            case "job": {
                prom = MainRunner.doJobsTest(conn);
                break;
            }

            case "total_job": {
                prom = MainRunner.doTotalJobTest(conn);
                break;
            }

            case "generic_job": {
                prom = MainRunner.doGenericJobTest(conn);
                break;
            }

            case "dynamic_imports": {
                prom = MainRunner.doDynamicImportsTest();
                break;
            }

            default: throw new Error("Invalid test");
        }

        await prom;

        await conn.close();
    }
}
