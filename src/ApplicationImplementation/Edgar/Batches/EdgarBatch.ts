import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { IBatchFilteringPolicy } from "../../../ApplicationModel/Batch/IBatchFilteringPolicy.js";
import { EdgarItem } from "../Items/EdgarItem.js";

class EdgarBatchBuilder {
    public usingFilteringPolicies(...policies: IBatchFilteringPolicy<EdgarItem>[]): void {
        
    }
}

export class EdgarItemBatch extends AbstractBatch<EdgarItem> {
    addItemToBatch(item: EdgarItem): Promise<AbstractBatch<EdgarItem>> {
        throw new Error("Method not implemented.");
    }

    loadItems(): Promise<EdgarItem[]> {
        throw new Error("Method not implemented.");
    }
    getLoadedItems(): EdgarItem[] | null {
        throw new Error("Method not implemented.");
    }
    
    public static builder(): EdgarBatchBuilder {
        return new EdgarBatchBuilder();
    }
}
