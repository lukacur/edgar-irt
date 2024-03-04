import { execFile } from "child_process";
import { AdaptiveGradingDaemon } from "./AdaptiveGradingDaemon/AdaptiveGradingDaemon.js";
import { DatabaseConnection } from "./ApplicationImplementation/Database/DatabaseConnection.js";
import { AbstractLogisticFunctionParams } from "./IRT/LogisticFunction/LogisticFunctionTypes.js";
import { StandardLogisticFunction } from "./IRT/LogisticFunction/StandardLogisticFunction.js";
import { DelayablePromise } from "./Util/DelayablePromise.js";
import { EdgarRStatisticsProcessor } from "./ApplicationImplementation/Edgar/Statistics/EdgarRStatisticsProcessor.js";
import { CourseBasedBatch } from "./ApplicationImplementation/Edgar/Batches/CourseBasedBatch.js";
import { IRTService } from "./IRTService.js";
import { QueryDriver } from "./Drivers/QueryDriver.js";
import { TempParamGenerator } from "./ParameterGenerators/TempParamGenerator.js";

type AvailableTests = "db" | "child_process" | "stats_processor" | "delayed_promise" | "daemon" | "service_setup";

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
        const statsProc = new EdgarRStatisticsProcessor(
            "test_script.r",
            "B:/testna/r/json_in.json",
            "irt",
            new CourseBasedBatch(
                dbConn,
                2,
                [1]
            ),
            MainRunner.DEFAULT_TIMEOUT_MS,
            "B:/testna/r/json_out.json",
        );

        const gaussDistrib = await statsProc.getGaussianDistrib();
        console.log(gaussDistrib);
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

    private static async doDaemonTest(args: string[]): Promise<void> {
        console.log("Passed arguments:");
        console.log(args);
        console.log("-----------------");

        const daemon = new AdaptiveGradingDaemon(
            "./adapGrading.config.json",
            () => console.log("Yea..."),
            { waitForActionCompletion: true, actionProgress: { reportActionProgress: true, noReports: 10 } },
            (dmn, reason) => console.log(`This is a forced daemon shutdown: ${reason ?? ""}`)
        );

        let terminated = false;

        (async () => {
            await daemon.start();

            const prm = new DelayablePromise<void>();

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
            }
        })();

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

    private static async doServiceSetupTest(): Promise<void> {
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
    }

    private static readonly CURRENT_TEST: AvailableTests = "stats_processor";

    public static async main(args: string[]): Promise<void> {
        const conn = await DatabaseConnection.fromConfigFile("./database-config.json");
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

            case "daemon": {
                prom = MainRunner.doDaemonTest(args);
                break;
            }

            case "service_setup": {
                prom = MainRunner.doServiceSetupTest();
                break;
            }

            default: throw new Error("Invalid test");
        }

        await prom;
    }
}
