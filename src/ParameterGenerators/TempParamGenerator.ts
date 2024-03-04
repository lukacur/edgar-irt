import { IParameterGenerator } from "../ApplicationModel/ParameterGeneration/IParameterGenerator.js";
import { AbstractStatisticsProcessor } from "../ApplicationModel/StatisticsProcessor/AbstractStatisticsProcessor.js";
import { IItem } from "../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../IRT/LogisticFunction/LogisticFunctionTypes.js";

export class TempParamGenerator implements IParameterGenerator {
    generateParameters(statisticsProcessor: AbstractStatisticsProcessor, item: IItem): Promise<Map<IItem, AbstractLogisticFunctionParams>> {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(new Map()), 1600);
        });
    }
}
