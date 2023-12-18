import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { AbstractBatch } from "../Batch/AbstractBatch.js";

export abstract class AbstractIRTDriver<TItem extends IItem> {
    constructor() {}

    public abstract createBatch(): Promise<AbstractBatch<TItem>>;

    public abstract postResult(batchProcessingResult: Map<TItem, AbstractLogisticFunctionParams>): Promise<boolean>;
}
