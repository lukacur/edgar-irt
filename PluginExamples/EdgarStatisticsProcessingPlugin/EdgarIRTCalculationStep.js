var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EdgarStatsProcessingConstants } from "../../dist/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { StatProcessingJobBatchCache } from "../../dist/ApplicationImplementation/Edgar/Jobs/EdgarStatisticsProcessing/StatProcessingJobBatchCache.js";
import { AbstractGenericJobStep } from "../../dist/ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { FrameworkLogger } from "../../dist/Logger/FrameworkLogger.js";
export class EdgarIRTCalculationStep extends AbstractGenericJobStep {
    determineBorderingParamValues(questionIrtParams) {
        const borderParamVals = {
            minLevelOfItemKnowledge: null,
            maxLevelOfItemKnowledge: null,
            minItemDifficulty: null,
            maxItemDifficulty: null,
        };
        for (const param of questionIrtParams) {
            if (borderParamVals.minLevelOfItemKnowledge === null ||
                param.params.levelOfItemKnowledge < borderParamVals.minLevelOfItemKnowledge) {
                borderParamVals.minLevelOfItemKnowledge = param.params.levelOfItemKnowledge;
            }
            if (borderParamVals.maxLevelOfItemKnowledge === null ||
                param.params.levelOfItemKnowledge > borderParamVals.maxLevelOfItemKnowledge) {
                borderParamVals.maxLevelOfItemKnowledge = param.params.levelOfItemKnowledge;
            }
            if (borderParamVals.minItemDifficulty === null ||
                param.params.itemDifficulty < borderParamVals.minItemDifficulty) {
                borderParamVals.minItemDifficulty = param.params.itemDifficulty;
            }
            if (borderParamVals.maxItemDifficulty === null ||
                param.params.itemDifficulty > borderParamVals.maxItemDifficulty) {
                borderParamVals.maxItemDifficulty = param.params.itemDifficulty;
            }
        }
        return borderParamVals;
    }
    normalizeParams(questionIrtParams) {
        const borderParamVals = this.determineBorderingParamValues(questionIrtParams);
        if (borderParamVals.minLevelOfItemKnowledge === null ||
            borderParamVals.maxLevelOfItemKnowledge === null ||
            borderParamVals.minItemDifficulty === null ||
            borderParamVals.maxItemDifficulty === null) {
            FrameworkLogger.warn(EdgarIRTCalculationStep, "No border values could be determined for either level of item knowledge or item difficulty. " +
                "Normalization skipped.");
            return questionIrtParams;
        }
        const preNormalizationLevelOfItemKnowMin = Math.abs(borderParamVals.minLevelOfItemKnowledge) + 1.5;
        const midNormalizationLevelOfItemKnowMin = 1.0;
        const midNormalizationLevelOfItemKnowMax = Math.log(borderParamVals.maxLevelOfItemKnowledge + preNormalizationLevelOfItemKnowMin) /
            Math.log(preNormalizationLevelOfItemKnowMin);
        const preNormalizationItemDifficultyMin = Math.abs(borderParamVals.minItemDifficulty) + 1.5;
        const midNormalizationItemDifficultyMin = 1.0;
        const midNormalizationItemDifficultyMax = Math.log(borderParamVals.maxItemDifficulty + preNormalizationItemDifficultyMin) /
            Math.log(preNormalizationItemDifficultyMin);
        return questionIrtParams.map(param => {
            const midNormalizedLevelOfItemKnow = Math.log(param.params.levelOfItemKnowledge + preNormalizationLevelOfItemKnowMin) /
                Math.log(preNormalizationLevelOfItemKnowMin);
            const newLevelOfItemKnow = (midNormalizedLevelOfItemKnow - midNormalizationLevelOfItemKnowMin) /
                (midNormalizationLevelOfItemKnowMax - midNormalizationLevelOfItemKnowMin);
            const midNormalizedItemDiff = Math.log(param.params.itemDifficulty + preNormalizationItemDifficultyMin) /
                Math.log(preNormalizationItemDifficultyMin);
            const newItemDiff = (midNormalizedItemDiff - midNormalizationItemDifficultyMin) /
                (midNormalizationItemDifficultyMax - midNormalizationItemDifficultyMin);
            return Object.assign(Object.assign({}, param), { params: {
                    levelOfItemKnowledge: newLevelOfItemKnow,
                    itemDifficulty: newItemDiff,
                    itemGuessProbability: param.params.itemGuessProbability,
                    itemMistakeProbability: param.params.itemMistakeProbability,
                } });
        });
    }
    runTyped(stepInput) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            if (((_a = stepInput[0]) !== null && _a !== void 0 ? _a : null) === null) {
                return {
                    status: "failure",
                    result: null,
                    reason: `Previous step returned null, but this step requires an input (in ${EdgarIRTCalculationStep.name})`,
                    isCritical: this.isCritical,
                };
            }
            const calculationResult = stepInput[0];
            const irtParamCalculations = [];
            for (const cbCalculation of (_b = calculationResult.courseBased) !== null && _b !== void 0 ? _b : []) {
                const qTestBasedCalcs = calculationResult.testBased
                    .flatMap(tbc => tbc.testData.filter(td => td.idQuestion === cbCalculation.idQuestion));
                const qCalcInfo = {
                    courseBasedCalc: cbCalculation,
                    testBasedCalcs: qTestBasedCalcs,
                    relatedTestInstances: (_d = (yield ((_c = StatProcessingJobBatchCache.instance.getCachedJobBatch(this.stepConfiguration.jobId)) === null || _c === void 0 ? void 0 : _c.getTestInstancesWithQuestion(cbCalculation.idQuestion)))) !== null && _d !== void 0 ? _d : [],
                };
                irtParamCalculations.push({
                    idQuestion: cbCalculation.idQuestion,
                    defaultItemOffsetParam: 1.0,
                    params: {
                        itemDifficulty: EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateItemDifficulty(qCalcInfo),
                        levelOfItemKnowledge: EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateLevelOfItemKnowledge(qCalcInfo),
                        itemGuessProbability: EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateItemGuessProbability(qCalcInfo),
                        itemMistakeProbability: EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateItemMistakeProbability(qCalcInfo),
                    }
                });
            }
            return {
                status: "success",
                result: Object.assign(Object.assign({}, calculationResult), { calculatedIrtParams: this.normalizeParams(irtParamCalculations) }),
                isCritical: this.isCritical,
                resultTTLSteps: this.resultTTL,
            };
        });
    }
}
EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD = 0.45;
EdgarIRTCalculationStep.GOOD_STUDENT_THRESHOLD = 0.7;
EdgarIRTCalculationStep.BAD_STUDENT_THRESHOLD = 0.4;
EdgarIRTCalculationStep.IRTCalculationConfiguration = {
    calculateLevelOfItemKnowledge: (qCalcInfo) => {
        var _a, _b, _c;
        const courseBased = qCalcInfo.courseBasedCalc;
        const testBased = qCalcInfo.testBasedCalcs;
        let numberOfGoodStudentCorrectAnswers = 0;
        let numberOfGoodStudentIncorrectAnswers = 0;
        let numberOfBadStudentCorrectAnswers = 0;
        let numberOfBadStudentInorrectAnswers = 0;
        for (const testInstance of qCalcInfo.relatedTestInstances) {
            const isConsideredGoodStudent = ((_a = testInstance.score_perc) !== null && _a !== void 0 ? _a : 0) > EdgarIRTCalculationStep.GOOD_STUDENT_THRESHOLD;
            const isConsideredCorrect = (((_b = testInstance.scoredOnQuestion) !== null && _b !== void 0 ? _b : 0) / ((_c = testInstance.questionMaxScore) !== null && _c !== void 0 ? _c : 1)) >= EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD;
            if (isConsideredGoodStudent && isConsideredCorrect) {
                numberOfGoodStudentCorrectAnswers++;
            }
            else if (isConsideredGoodStudent) {
                numberOfGoodStudentIncorrectAnswers++;
            }
            else if (!isConsideredGoodStudent && isConsideredCorrect) {
                numberOfBadStudentCorrectAnswers++;
            }
            else if (!isConsideredGoodStudent) {
                numberOfBadStudentInorrectAnswers;
            }
        }
        return (((numberOfGoodStudentCorrectAnswers + numberOfBadStudentInorrectAnswers) /
            (numberOfBadStudentCorrectAnswers + numberOfGoodStudentIncorrectAnswers + 1)) /*+ 1*/) /* *
        ((courseBased.incorrectPerc + 0.1) / (courseBased.correctPerc + 0.1)) *
        (testBased.reduce((acc, e) => acc + (e.partOfTotalSum ?? 0), 0) * (testBased.length + 1)) * 10*/;
    },
    calculateItemDifficulty: (qCalcInfo) => {
        var _a, _b;
        const courseBased = qCalcInfo.courseBasedCalc;
        const testBased = qCalcInfo.testBasedCalcs;
        let partialsConsideredCorrect = 0;
        let partialsConsideredIncorrect = 0;
        for (const rti of qCalcInfo.relatedTestInstances) {
            if (((_a = rti.scoredOnQuestion) !== null && _a !== void 0 ? _a : 0) / ((_b = rti.questionMaxScore) !== null && _b !== void 0 ? _b : 1) >= EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD) {
                partialsConsideredCorrect++;
            }
            else {
                partialsConsideredIncorrect++;
            }
        }
        const partialsTotal = partialsConsideredCorrect + partialsConsideredIncorrect;
        const correctPartialsPerc = (partialsConsideredCorrect / partialsTotal) * courseBased.partialPerc;
        const incorrectPartialsPerc = (partialsConsideredIncorrect / partialsTotal) * courseBased.partialPerc;
        const finalCrsBasedCorrPerc = correctPartialsPerc + courseBased.correctPerc;
        const finalCrsBasedIncPerc = incorrectPartialsPerc + courseBased.incorrectPerc;
        return (1.1 / (courseBased.scorePercMean + 0.1)) *
            Math.sqrt(qCalcInfo.relatedTestInstances.length + 1) *
            ((finalCrsBasedCorrPerc + 0.1) / (finalCrsBasedIncPerc + 0.1)) /* *
        (testBased.reduce((acc, e) => acc + (e.scorePercMedian ?? 0), 0) * (testBased.length + 1))*/;
    },
    calculateItemGuessProbability: (qCalcInfo) => {
        const courseBased = qCalcInfo.courseBasedCalc;
        const testBased = qCalcInfo.testBasedCalcs;
        const numberOfCorrectAnswersByLowScoringStudents = qCalcInfo.relatedTestInstances.reduce((acc, el) => {
            var _a, _b, _c;
            return acc += ((((_a = el.score_perc) !== null && _a !== void 0 ? _a : 0) < EdgarIRTCalculationStep.BAD_STUDENT_THRESHOLD &&
                (((_b = el.scoredOnQuestion) !== null && _b !== void 0 ? _b : 0) / ((_c = el.questionMaxScore) !== null && _c !== void 0 ? _c : 1)) >= EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD) ? 1 : 0);
        }, 0);
        return courseBased.correctPerc *
            (numberOfCorrectAnswersByLowScoringStudents / qCalcInfo.relatedTestInstances.length);
    },
    calculateItemMistakeProbability: (qCalcInfo) => {
        const courseBased = qCalcInfo.courseBasedCalc;
        const testBased = qCalcInfo.testBasedCalcs;
        const numberOfIncorrectAnswersByHighScoringStudents = qCalcInfo.relatedTestInstances.reduce((acc, el) => {
            var _a, _b, _c;
            return acc += ((((_a = el.score_perc) !== null && _a !== void 0 ? _a : 0) > EdgarIRTCalculationStep.GOOD_STUDENT_THRESHOLD &&
                (((_b = el.scoredOnQuestion) !== null && _b !== void 0 ? _b : 0) / ((_c = el.questionMaxScore) !== null && _c !== void 0 ? _c : 1)) < EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD) ? 1 : 0);
        }, 0);
        return courseBased.incorrectPerc *
            (1 - (numberOfIncorrectAnswersByHighScoringStudents / qCalcInfo.relatedTestInstances.length));
    }
};
const impl = {
    namespace: EdgarStatsProcessingConstants.CALCULATE_IRT_PARAMETERS_STEP_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.CALCULATE_IRT_PARAMETERS_STEP_ENTRY.split("/")[1],
    registry: "JobStep",
    creationFunction(stepDescriptor, jobConfig, ...args) {
        return new EdgarIRTCalculationStep(stepDescriptor.stepTimeoutMs, { jobId: jobConfig.jobId }, stepDescriptor.isCritical, stepDescriptor.resultTTL);
    }
};
export default impl;
