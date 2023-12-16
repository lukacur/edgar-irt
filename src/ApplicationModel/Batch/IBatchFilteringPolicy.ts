import { IItem } from "../../IRT/Item/IItem.js";

export interface IBatchFilteringPolicy<TItem extends IItem> {
    applyFilter(item: TItem): boolean;
}
