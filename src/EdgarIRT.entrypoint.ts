import { AdaptiveGradingDaemon } from "./AdaptiveGradingDaemon/AdaptiveGradingDaemon.js";
import { AbstractLogisticFunctionParams } from "./IRT/LogisticFunction/LogisticFunctionTypes.js";
import { StandardLogisticFunction } from "./IRT/LogisticFunction/StandardLogisticFunction.js";
import { DelayablePromise } from "./Util/DelayablePromise.js";

export class MainRunner {
    /*private static async delayableAwaiter<T>(prom: DelayablePromise<T>) {
        await prom.getWrappedPromise();
        console.log("delayableAwaiter")
    }*/

    public static main(args: string[]): void {
        /*const logFn = new StandardLogisticFunction(1, AbstractLogisticFunctionParams.createParams(0.65, 0.40, 0.20, 0.95));

        console.log(logFn.apply(5.5));

        const delayedPromise: DelayablePromise<boolean> = new DelayablePromise();
        MainRunner.delayableAwaiter(delayedPromise);

        setTimeout(() => {
            console.log("Timeout");
            delayedPromise.delayedResolve(true);
        }, 2000);

        delayedPromise.getWrappedPromise().then(() => {
            console.log("Main");
        });*/

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
}
