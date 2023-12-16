import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { AbstractBatch } from "../Batch/AbstractBatch.js";

export interface IIRTRunner<TItem extends IItem> {
    loadItemBatch(itemBatch: AbstractBatch<TItem>): Promise<void>;
    addItem(item: TItem): Promise<void>;
    batchCalculateParams(): Map<TItem, AbstractLogisticFunctionParams>;
}
