import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractBatch } from "../Batch/AbstractBatch.js";

export abstract class AbstractIRTDriver<TItem extends IItem, TProcessingResult> {
    constructor() {}

    public abstract createBatch(): Promise<AbstractBatch<TItem>>;

    public abstract failPost(item: TItem): Promise<void>;

    public abstract postResult(batchProcessingResult: TProcessingResult): Promise<boolean>;
}
