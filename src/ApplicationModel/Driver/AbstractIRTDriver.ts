import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { AbstractBatch } from "../Batch/AbstractBatch.js";

export abstract class AbstractIRTDriver<TItem extends IItem> {
    constructor() {}

    abstract createBatch(): Promise<AbstractBatch<TItem>>;

    abstract postResult(batchProcessingResult: Map<TItem, AbstractLogisticFunctionParams>): Promise<boolean>;
}
