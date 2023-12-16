import { IItem } from "../../IRT/Item/IItem.js";

export abstract class AbstractItemParticipant {
    constructor(
        protected readonly item: IItem
    ) {}

    public abstract getScore(): number;

    public async getScorePercentage(): Promise<number> {
        return this.getScore() / await this.item.getMaxScore();
    }
}
