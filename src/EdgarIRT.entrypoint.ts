import { AbstractLogisticFunctionParams } from "./IRT/LogisticFunction/LogisticFunctionTypes.js";
import { StandardLogisticFunction } from "./IRT/LogisticFunction/StandardLogisticFunction.js";

export class MainRunner {
    public static main(args: string[]): void {
        const logFn = new StandardLogisticFunction(1, AbstractLogisticFunctionParams.createParams(0.65, 0.40, 0.20, 0.95));

        console.log(logFn.apply(5.5));
    }
}
