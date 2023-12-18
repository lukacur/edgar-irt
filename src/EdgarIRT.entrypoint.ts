import { AbstractLogisticFunctionParams } from "./IRT/LogisticFunction/LogisticFunctionTypes.js";
import { StandardLogisticFunction } from "./IRT/LogisticFunction/StandardLogisticFunction.js";
import { DelayablePromise } from "./Util/DelayablePromise.js";

export class MainRunner {
    private static async delayableAwaiter<T>(prom: DelayablePromise<T>) {
        await prom.getWrappedPromise();
        console.log("delayableAwaiter")
    }

    public static main(args: string[]): void {
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
}
