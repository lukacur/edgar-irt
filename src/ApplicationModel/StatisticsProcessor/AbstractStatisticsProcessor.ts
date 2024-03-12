import { IDistributionFunction } from "../../Functions/IDistributionFunction.js";
import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractItemParticipant } from "../Participant/AbstractItemParticipant.js";

export abstract class AbstractStatisticsProcessor<TProcessingResult> {
    constructor(
        protected readonly item: IItem | null
    ) {}

    protected async sortParticipantsByScore(): Promise<AbstractItemParticipant[]> {
        if (this.item === null) {
            throw new Error("Invalid configuration for the statistics processor: item can't be null");
        }

        return (await this.item.getParticipants())
            .sort((part1, part2) => part1.getScore() - part2.getScore());
    }

    public abstract process(): Promise<TProcessingResult | null>;

    public abstract clone(item: IItem): AbstractStatisticsProcessor<TProcessingResult>;
}
