import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { EdgarItem } from "../Items/EdgarItem.js";

export class TestBasedBatch extends AbstractBatch<EdgarItem> {
    loadItems(): Promise<EdgarItem[]> {
        throw new Error("Method not implemented.");
    }
    addItemToBatch(item: EdgarItem): Promise<AbstractBatch<EdgarItem>> {
        throw new Error("Method not implemented.");
    }
    getLoadedItems(): EdgarItem[] {
        throw new Error("Method not implemented.");
    }
    
}
