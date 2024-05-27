import { QuestionClassification } from "../../../Statistics/IRCalculationResult.js";

export class QuestionClassificationUtil {
    public static readonly instance = new QuestionClassificationUtil();

    private constructor() {}

    private readonly classificationOrder: QuestionClassification[] = [
        "very_easy",
        "easy",
        "normal",
        "hard",
        "very_hard",
    ];

    public isLowestClass(qClass: QuestionClassification) {
        const index = this.classificationOrder.indexOf(qClass);
        if (index === -1) {
            throw new Error(`${qClass} is not a valid question classification`);
        }

        return index === 0;
    }

    public isHighestClass(qClass: QuestionClassification) {
        const index = this.classificationOrder.indexOf(qClass);
        if (index === -1) {
            throw new Error(`${qClass} is not a valid question classification`);
        }

        return index === (this.classificationOrder.length - 1);
    }

    public getDifficultyRanks(difficulties: QuestionClassification[]): number[] {
        return difficulties
            .map(diff => this.classificationOrder.indexOf(diff))
            .filter(diffIdx => diffIdx !== -1);
    }

    public getDifficultyForRank(rank: number): QuestionClassification {
        if (rank < 0 || rank >= this.classificationOrder.length || !Number.isInteger(rank)) {
            throw new Error("Invalid rank");
        }

        return this.classificationOrder[rank];
    }

    public getAverageDifficulty(difficulties: QuestionClassification[]): QuestionClassification {
        const idxArr = this.getDifficultyRanks(difficulties);

        const finalIdx = Math.floor(
            idxArr.reduce((acc, el) => acc + el, 0) / idxArr.length
        );

        if (finalIdx < 0 || finalIdx > this.classificationOrder.length) {
            throw new Error("Unable to calculate average difficulty for given difficulties array");
        }

        return this.classificationOrder[finalIdx];
    }
}
