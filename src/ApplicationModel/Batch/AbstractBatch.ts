import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractItemParticipant } from "../Participant/AbstractItemParticipant.js";
import { ItemBatchException } from "./ItemBatchException.js";

/**
 * Models a batch of IRT items that are similar and test the same ability. A batch shouldn't contain items that test
 * different abilities (e.g. a batch testing mathematical addition must only contain items that test mathematical
 * addition and no other items). This is set by the IRT requirements. Models a composite of IItem instances
 */
export abstract class AbstractBatch<TItem extends IItem> implements IItem {
    protected items: TItem[] | null = null;
    
    abstract loadItems(): Promise<TItem[]>;
    abstract addItemToBatch(item: TItem): Promise<void>;
    abstract getLoadedItems(): TItem[];

    public async getParticipants(): Promise<AbstractItemParticipant[]> {
        if (this.items === null) {
            throw new ItemBatchException("Item batch wasn't initialized: no items loaded");
        }

        const allParts: AbstractItemParticipant[] = [];

        for (const item of this.items) {
            allParts.push(...(await item.getParticipants()));
        }

        return allParts;
    }

    public async getMaxScore(): Promise<number> {
        if (this.items === null) {
            throw new ItemBatchException("Item batch wasn't initialized: no items loaded");
        }

        return (await Promise.all(this.items.map(item => item.getMaxScore()))).reduce((acc, el) => acc + el, 0.0);
    }
}
