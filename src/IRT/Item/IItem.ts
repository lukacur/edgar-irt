import { AbstractItemParticipant } from "../../ApplicationModel/Participant/AbstractItemParticipant.js";

export interface IItem {
    getParticipants(): Promise<AbstractItemParticipant[]>;
    getMaxScore(): Promise<number>;
}
