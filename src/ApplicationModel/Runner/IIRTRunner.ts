import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { IBatch } from "../Batch/IBatch.js";

export interface IIRTRunner<TItem extends IItem> {
    loadItemBatch(itemBatch: IBatch<TItem>): Promise<void>;
    addItem(item: TItem): Promise<void>;
    batchCalculateParams(): Map<TItem, AbstractLogisticFunctionParams>;
}
