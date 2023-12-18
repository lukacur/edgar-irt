import { AbstractLogisticFunctionParams } from "./LogisticFunctionTypes.js";

export interface ILogisticFunction {
    apply(theta: number): number;
}

export class StandardLogisticFunction implements ILogisticFunction {
    constructor(
        private readonly defaultOffsetParameter: number,
        private readonly params: AbstractLogisticFunctionParams
    ) {}

    private calculateCommon(theta: number): number {
        const paramValues = this.params.getParams();

        return 1.0 /
            (1.0 +
                Math.pow(
                    Math.E,
                    -paramValues.levelOfItemKnowledge * this.defaultOffsetParameter * (theta - paramValues.itemDifficulty)
                )
            );
    }

    public apply(theta: number): number {
        const paramValues = this.params.getParams();

        return paramValues.itemGuessProbability +
            (paramValues.itemMistakeProbability - paramValues.itemGuessProbability) * this.calculateCommon(theta);
    }
}
