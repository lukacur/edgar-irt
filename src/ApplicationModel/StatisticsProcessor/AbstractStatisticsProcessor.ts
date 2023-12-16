import { DistributionFunction } from "../../Functions/DistributionFunction.js";
import { IItem } from "../../IRT/Item/Item.js";
import { IItemParticipant } from "../Participant/IItemParticipant.js";

export abstract class AbstractStatisticsProcessor {
    constructor(
        protected readonly item: IItem
    ) {}

    protected async sortParticipantsByScore(): Promise<IItemParticipant[]> {
        return (await this.item.getParticipants())
            .sort((part1, part2) => part1.getScore() - part2.getScore());
    }

    public abstract getMaxScore(): Promise<number>;

    public abstract getScoreAverage(): Promise<number>;

    public abstract getScoreStdDev(): Promise<number>;

    public abstract getScoreNtiles(ntile: number): Promise<number[] | null>;

    public abstract getScoreQuartiles(): Promise<[number, number, number, number]>;
    
    public abstract getScoreMedian(): Promise<number>;

    public abstract getNBestParticipants(n: number): Promise<IItemParticipant[]>;

    public abstract getNWorstParticipants(n: number): Promise<IItemParticipant[]>;

    public abstract getGaussianDistrib(): Promise<DistributionFunction>;

    public abstract createNew(item: IItem): AbstractStatisticsProcessor;
}
