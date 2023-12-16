export interface LogisticFunctionParams {
    readonly levelOfKnowledge: number;
    readonly itemDifficulty: number;
    readonly itemGuessProbability: number;
    readonly itemMistakeProbability: number;
}

export abstract class AbstractLogisticFunctionParams {
    protected readonly levelOfKnowledge: number;
    protected readonly itemDifficulty: number;
    protected readonly itemGuessProbability: number;
    protected readonly itemFailProbability: number;
    
    constructor(
        levelOfKnowledge: number,
        itemDifficulty?: number,
        itemGuessProbability?: number,
        itemFailProbability?: number
    ) {
        this.levelOfKnowledge = levelOfKnowledge ?? 0.0;
        this.itemDifficulty = itemDifficulty ?? 0.0;
        this.itemGuessProbability = itemGuessProbability ?? 0.0;
        this.itemFailProbability = itemFailProbability ?? 0.0;
    }

    public static createParams(
        levelOfKnowledge: number,
        itemDifficulty?: number,
        itemGuessProbability?: number,
        itemFailProbability?: number
    ) {
        return new _LogisticFunctionParams(levelOfKnowledge, itemDifficulty, itemGuessProbability, itemFailProbability);
    }

    public getParams(): LogisticFunctionParams {
        return {
            levelOfKnowledge: this.levelOfKnowledge,
            itemDifficulty: this.itemDifficulty,
            itemGuessProbability: this.itemGuessProbability,
            itemMistakeProbability: this.itemFailProbability,
        };
    }
}

class _LogisticFunctionParams extends AbstractLogisticFunctionParams {}

export interface ILogisticFunction {
    apply: (theta: number) => number;
}
