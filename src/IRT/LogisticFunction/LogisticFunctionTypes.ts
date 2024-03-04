export interface LogisticFunctionParams {
    readonly levelOfItemKnowledge: number; // 'a' parameter
    readonly itemDifficulty: number; // 'b' parameter
    readonly itemGuessProbability: number; // 'c' parameter
    readonly itemMistakeProbability: number; // 'd' parameter
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
    ): AbstractLogisticFunctionParams {
        return new _LogisticFunctionParams(levelOfKnowledge, itemDifficulty, itemGuessProbability, itemFailProbability);
    }

    public getParams(): LogisticFunctionParams {
        return {
            levelOfItemKnowledge: this.levelOfKnowledge,
            itemDifficulty: this.itemDifficulty,
            itemGuessProbability: this.itemGuessProbability,
            itemMistakeProbability: this.itemFailProbability,
        };
    }
}

class _LogisticFunctionParams extends AbstractLogisticFunctionParams {}
