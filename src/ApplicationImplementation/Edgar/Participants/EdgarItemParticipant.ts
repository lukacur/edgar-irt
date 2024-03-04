import { AbstractItemParticipant } from "../../../ApplicationModel/Participant/AbstractItemParticipant.js";
import { IItem } from "../../../IRT/Item/IItem.js";

export abstract class EdgarItemParticipant<TParticipantID> extends AbstractItemParticipant {
    constructor(
        item: IItem,

        protected readonly id: TParticipantID,

        protected readonly score: number,
        protected readonly scorePercentage: number,
    ) { super(item); }

    public getScore(): number {
        return this.score
    }
}
