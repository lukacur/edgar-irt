import { IItem } from "../../IRT/Item/IItem.js";
import { AbstractLogisticFunctionParams } from "../../IRT/LogisticFunction/LogisticFunctionTypes.js";
import { AbstractStatisticsProcessor } from "../StatisticsProcessor/AbstractStatisticsProcessor.js";

export interface IParameterGenerator {
    generateParameters(statisticsProcessor: AbstractStatisticsProcessor, item: IItem):
        Map<IItem, AbstractLogisticFunctionParams>;
}
