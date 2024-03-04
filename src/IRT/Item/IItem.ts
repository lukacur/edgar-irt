import { AbstractItemParticipant } from "../../ApplicationModel/Participant/AbstractItemParticipant.js";

export interface IItem {
    getParticipants(): Promise<AbstractItemParticipant[]>;
    getMaxScore(): Promise<number>;

    getItems(): IItem[]; // TODO: add '| null' as retval or IItem returns [] if not a Batch instance
    // TODO: add method 'isBatch(): boolean' for which only batches return true
}
