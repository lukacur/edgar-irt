import { TestInstanceAdditionalInfo } from "../../Edgar/Batches/EdgarBatch.js";
import { CourseBasedCalculation, TestBasedCalculation } from "../../Edgar/Statistics/IRCalculationResult.js";

export type QuestionCalcultionInfo = {
    courseBasedCalc: CourseBasedCalculation;
    testBasedCalcs: TestBasedCalculation[];
    relatedTestInstances: TestInstanceAdditionalInfo[];
};

export interface IIRTParameterCalculator {
    calculateLevelOfItemKnowledge: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemDifficulty: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemGuessProbability: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemMistakeProbability: (qCalcInfo: QuestionCalcultionInfo) => number,
}
