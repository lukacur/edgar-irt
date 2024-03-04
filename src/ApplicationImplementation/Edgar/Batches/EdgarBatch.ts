import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { IBatchFilteringPolicy } from "../../../ApplicationModel/Batch/IBatchFilteringPolicy.js";
import { IItem } from "../../../IRT/Item/IItem.js";
import { EdgarItem } from "../Items/EdgarItem.js";

class EdgarBatchBuilder {
    public usingFilteringPolicies(...policies: IBatchFilteringPolicy<EdgarItem>[]): void {
        
    }
}

export abstract class EdgarItemBatch<TEdgarBatchItem extends IItem> extends AbstractBatch<TEdgarBatchItem> {
    abstract serializeInto(obj: any): Promise<void>;
    
    public static builder(): EdgarBatchBuilder {
        return new EdgarBatchBuilder();
    }
}
