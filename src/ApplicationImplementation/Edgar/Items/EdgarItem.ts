import { AbstractItemParticipant } from "../../../ApplicationModel/Participant/AbstractItemParticipant.js";
import { IItem } from "../../../IRT/Item/IItem.js";
import { EdgarItemParticipant } from "../Participants/EdgarItemParticipant.js";

export abstract class EdgarItem implements IItem {
    protected readonly participants: EdgarItemParticipant<number>[] = [];

    constructor(
        protected readonly id: number,
        protected readonly maxScore: number,
    ) {}

    getItems(): IItem[] {
        return [this];
    }

    public async getParticipants(): Promise<AbstractItemParticipant[]> {
        return this.participants;
    }

    public async getMaxScore(): Promise<number> {
        return this.maxScore;
    }
}
