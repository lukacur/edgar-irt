import { IDistributionFunction } from "../../Functions/IDistributionFunction.js";
import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractItemParticipant } from "../Participant/AbstractItemParticipant.js";
import { AbstractStatisticsProcessor } from "./AbstractStatisticsProcessor.js";

export class JSRuntimeStatisticsProcessor extends AbstractStatisticsProcessor {
    public async getMaxScore(): Promise<number> {
        return (await this.sortParticipantsByScore())
            .reverse()[0].getScore();
    }

    public async getScoreAverage(): Promise<number> {
        const avgArr = (await this.sortParticipantsByScore())
            .map(p => p.getScore());
        
        return avgArr.reduce((acc, el) => acc + el, 0.0) / avgArr.length;
    }

    public async getScoreStdDev(): Promise<number> {
        const scoreAvg = await this.getScoreAverage();
        const stdDevArr = (await this.sortParticipantsByScore()); // TODO: beautify - remove pars.
        const sampleSize = stdDevArr.length;

        return Math.sqrt(stdDevArr.reduce((acc, p) => acc + Math.pow(p.getScore() - scoreAvg, 2.0), 0.0) / sampleSize);
    }

    public async getScoreNtiles(ntile: number): Promise<number[] | null> {
        throw new Error("Method not implemented");
    }

    public async getScoreQuartiles(): Promise<[number, number, number, number]> {
        const quartileArr = (await this.sortParticipantsByScore())
            .map(p => p.getScore());
        
        const firstSliceEnd = Math.floor(quartileArr.length / 2);
        
        const leftSide = quartileArr.slice(0, firstSliceEnd);
        const lsHalf = Math.floor(leftSide.length / 2);

        const rightSide = quartileArr.slice(firstSliceEnd + ((quartileArr.length % 2 === 1) ? 1 : 0));
        const rsHalf = Math.floor(rightSide.length / 2);

        return [
            ((leftSide.length % 2 === 1) ? leftSide[lsHalf] : ((leftSide[lsHalf] + leftSide[lsHalf - 1]) / 2)),

            ((quartileArr.length % 2 === 1) ?
                quartileArr[firstSliceEnd] : (quartileArr[firstSliceEnd] + quartileArr[firstSliceEnd - 1]) / 2),

            ((rightSide.length % 2 === 1) ? rightSide[rsHalf] : ((rightSide[rsHalf] + rightSide[rsHalf - 1]) / 2)),

            quartileArr[quartileArr.length - 1]
        ];
    }

    public async getScoreMedian(): Promise<number> {
        return (await this.getScoreQuartiles())[1];
    }

    public async getNBestParticipants(n: number): Promise<AbstractItemParticipant[]> {
        const sortedParticipants = (await this.sortParticipantsByScore());
        return sortedParticipants.slice(0, Math.min(n, sortedParticipants.length));
    }

    public async getNWorstParticipants(n: number): Promise<AbstractItemParticipant[]> {
        const sortedParticipants = (await this.sortParticipantsByScore()).reverse();
        return sortedParticipants.slice(0, Math.min(n, sortedParticipants.length));
    }

    public async getGaussianDistrib(): Promise<IDistributionFunction> {
        const sigma = await this.getScoreStdDev();
        const u = await this.getScoreAverage();

        return {
            apply: (value) => {
                return (
                    (1 / sigma * Math.sqrt(2 * Math.PI))) *
                        Math.pow(Math.E, -0.5 * (Math.pow(value - u, 2.0) / Math.pow(sigma, 2.0))
                );
            }
        };
    }

    public createNew(item: IItem): AbstractStatisticsProcessor {
        return new JSRuntimeStatisticsProcessor(item);
    }
}
