import { AbstractBatch } from "../ApplicationModel/Batch/AbstractBatch.js";
import { AbstractIRTDriver } from "../ApplicationModel/Driver/AbstractIRTDriver.js";
import { IItem } from "../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../IRT/LogisticFunction/LogisticFunctionTypes.js";

class FooBatch<TItem extends IItem> extends AbstractBatch<TItem> {
    async loadItems(): Promise<TItem[]> {
        return [];
    }
    addItemToBatch(item: TItem): Promise<AbstractBatch<TItem>> {
        throw new Error("Method not implemented.");
    }
    getLoadedItems(): TItem[] {
        return [];
    }
    
}

export class QueryDriver<TItem extends IItem> extends AbstractIRTDriver<TItem> {
    public createBatch(): Promise<AbstractBatch<TItem>> {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(new FooBatch()), 1350);
        });
    }
    public async postResult(batchProcessingResult: Map<TItem, AbstractLogisticFunctionParams>): Promise<boolean> {
        return true;
    }
}
