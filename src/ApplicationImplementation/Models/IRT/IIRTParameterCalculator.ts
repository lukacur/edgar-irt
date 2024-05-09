import { CourseBasedCalculation, TestBasedCalculation } from "../../Edgar/Statistics/IRCalculationResult.js";
import { TestInstance } from "../Database/TestInstance/TestInstance.model.js";

export type QuestionCalcultionInfo = {
    courseBasedCalc: CourseBasedCalculation;
    testBasedCalcs: TestBasedCalculation[];
    relatedTestInstances: TestInstance[];
};

export interface IIRTParameterCalculator {
    calculateLevelOfItemKnowledge: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemDifficulty: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemGuessProbability: (qCalcInfo: QuestionCalcultionInfo) => number,
    calculateItemMistakeProbability: (qCalcInfo: QuestionCalcultionInfo) => number,
}
