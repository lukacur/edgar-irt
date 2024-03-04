import { IItem } from "../../IRT/Item/IItem.js";

// TODO: maybe add a 'getItem(): IItem' method?
export abstract class AbstractItemParticipant {
    constructor(
        protected readonly item: IItem
    ) {}

    public abstract getScore(): number;

    public abstract identify(): string;

    public async getScorePercentage(): Promise<number> {
        return this.getScore() / await this.item.getMaxScore();
    }

    public abstract clone(newScore: number): Promise<AbstractItemParticipant>; // TODO: add optional 'item: IItem' argument
}
