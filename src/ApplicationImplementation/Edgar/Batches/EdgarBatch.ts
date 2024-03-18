import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { IItem } from "../../../IRT/Item/IItem.js";

export abstract class EdgarItemBatch<TEdgarBatchItem extends IItem> extends AbstractBatch<TEdgarBatchItem> {
    abstract serializeInto(obj: any): Promise<void>;
}
