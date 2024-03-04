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
    abstract addItemToBatch(item: TItem): Promise<AbstractBatch<TItem>>;
    abstract getLoadedItems(): TItem[] | null;

    protected participantsCache: AbstractItemParticipant[] | null = null;

    public getItems(): IItem[] {
        return [...(this.items ?? [])];
    }

    public async getParticipants(): Promise<AbstractItemParticipant[]> {
        if (this.items === null) {
            throw new ItemBatchException("Item batch wasn't initialized: no items loaded");
        }

        if (this.participantsCache !== null) {
            return this.participantsCache;
        }

        const allParts: Map<string, AbstractItemParticipant[]> = new Map();

        for (const item of this.items) {
            const participants = (await item.getParticipants());

            for (const part of participants) {
                const partId = part.identify();

                if (!allParts.has(partId)) {
                    allParts.set(partId, []);
                }

                allParts.get(partId)?.push(part);
            }
        }

        const retVal: AbstractItemParticipant[] = [];

        for (const participants of allParts.values()) {
            const cloneable = participants[0];

            retVal.push(
                await cloneable.clone(participants.map(part => part.getScore()).reduce((acc, val) => acc + val, 0.0)) // TODO: extract into variable and set the batch as parent item of the clone
            );
        }

        return this.participantsCache = retVal;
    }

    public async getMaxScore(): Promise<number> {
        if (this.items === null) {
            throw new ItemBatchException("Item batch wasn't initialized: no items loaded");
        }

        return (await Promise.all(this.items.map(item => item.getMaxScore()))).reduce((acc, el) => acc + el, 0.0); // TODO: this can be cached as well
    }
}
