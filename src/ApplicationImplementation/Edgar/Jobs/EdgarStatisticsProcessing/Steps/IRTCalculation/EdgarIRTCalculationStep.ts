import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { IJobConfiguration, JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { FrameworkLogger } from "../../../../../../Logger/FrameworkLogger.js";
import { IIRTParameterCalculator, QuestionCalcultionInfo } from "../../../../../Models/IRT/IIRTParameterCalculator.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { IExtendedRCalculationResult, IRCalculationResult, QuestionIrtParamInfo } from "../../../../Statistics/IRCalculationResult.js";
import { StatProcessingJobBatchCache } from "../../StatProcessingJobBatchCache.js";
import { EdgarIRTCalculationStepConfiguration } from "./EdgarIRTCalculationStepConfiguration.js";

type BorderingParamValues = {
    minItemDifficulty: number | null,
    maxItemDifficulty: number | null,
    minLevelOfItemKnowledge: number | null,
    maxLevelOfItemKnowledge: number | null,
};

export class EdgarIRTCalculationStep
    extends AbstractGenericJobStep<EdgarIRTCalculationStepConfiguration, IRCalculationResult, IExtendedRCalculationResult> {

    private static readonly CORRECTNESS_THRESHOLD = 0.45;
    private static readonly GOOD_STUDENT_THRESHOLD = 0.7;
    private static readonly BAD_STUDENT_THRESHOLD = 0.4;

    private static readonly IRTCalculationConfiguration: IIRTParameterCalculator = {
        calculateLevelOfItemKnowledge: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            let numberOfGoodStudentCorrectAnswers = 0;
            let numberOfGoodStudentIncorrectAnswers = 0;
            let numberOfBadStudentCorrectAnswers = 0;
            let numberOfBadStudentInorrectAnswers = 0;

            for (const testInstance of qCalcInfo.relatedTestInstances) {
                const isConsideredGoodStudent =
                    (testInstance.score_perc ?? 0) > EdgarIRTCalculationStep.GOOD_STUDENT_THRESHOLD;

                const isConsideredCorrect = (
                    (testInstance.scoredOnQuestion ?? 0) / (testInstance.questionMaxScore ?? 1)
                ) >= EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD;

                if (isConsideredGoodStudent && isConsideredCorrect) {
                    numberOfGoodStudentCorrectAnswers++;
                } else if (isConsideredGoodStudent) {
                    numberOfGoodStudentIncorrectAnswers++;
                } else if (!isConsideredGoodStudent && isConsideredCorrect) {
                    numberOfBadStudentCorrectAnswers++;
                } else if (!isConsideredGoodStudent) {
                    numberOfBadStudentInorrectAnswers
                }
            }

            return (
                    (
                        (numberOfGoodStudentCorrectAnswers + numberOfBadStudentInorrectAnswers) /
                        (numberOfBadStudentCorrectAnswers + numberOfGoodStudentIncorrectAnswers + 1)
                    ) /*+ 1*/
                )/* *
                ((courseBased.incorrectPerc + 0.1) / (courseBased.correctPerc + 0.1)) *
                (testBased.reduce((acc, e) => acc + (e.partOfTotalSum ?? 0), 0) * (testBased.length + 1)) * 10*/;
        },

        calculateItemDifficulty: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            let partialsConsideredCorrect = 0;
            let partialsConsideredIncorrect = 0;

            for (const rti of qCalcInfo.relatedTestInstances) {
                if ((rti.scoredOnQuestion ?? 0) / (rti.questionMaxScore ?? 1) >= EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD) {
                    partialsConsideredCorrect++;
                } else {
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
                ((finalCrsBasedCorrPerc + 0.1) / (finalCrsBasedIncPerc + 0.1))/* *
                (testBased.reduce((acc, e) => acc + (e.scorePercMedian ?? 0), 0) * (testBased.length + 1))*/;
        },

        calculateItemGuessProbability: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            const numberOfCorrectAnswersByLowScoringStudents = qCalcInfo.relatedTestInstances.reduce(
                (acc, el) => 
                    acc += (
                        (
                            (el.score_perc ?? 0) < EdgarIRTCalculationStep.BAD_STUDENT_THRESHOLD &&
                                (
                                    (el.scoredOnQuestion ?? 0) / (el.questionMaxScore ?? 1)
                                ) >= EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD
                        ) ? 1 : 0
                    ),
                0
            );

            return courseBased.correctPerc *
                (numberOfCorrectAnswersByLowScoringStudents / qCalcInfo.relatedTestInstances.length);
        },

        calculateItemMistakeProbability: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            const numberOfIncorrectAnswersByHighScoringStudents = qCalcInfo.relatedTestInstances.reduce(
                (acc, el) =>
                    acc += (
                        (
                            (el.score_perc ?? 0) > EdgarIRTCalculationStep.GOOD_STUDENT_THRESHOLD &&
                            (
                                (el.scoredOnQuestion ?? 0) / (el.questionMaxScore ?? 1)
                            ) < EdgarIRTCalculationStep.CORRECTNESS_THRESHOLD
                        ) ? 1 : 0
                    ),
                0
            );

            return courseBased.incorrectPerc *
                (1 - (numberOfIncorrectAnswersByHighScoringStudents / qCalcInfo.relatedTestInstances.length));
        }
    };

    private determineBorderingParamValues(questionIrtParams: QuestionIrtParamInfo[]): BorderingParamValues {
        const borderParamVals: BorderingParamValues = {
            minLevelOfItemKnowledge: null,
            maxLevelOfItemKnowledge: null,
            minItemDifficulty: null,
            maxItemDifficulty: null,
        };

        for (const param of questionIrtParams) {
            if (
                borderParamVals.minLevelOfItemKnowledge === null ||
                param.params.levelOfItemKnowledge < borderParamVals.minLevelOfItemKnowledge
            ) {
                borderParamVals.minLevelOfItemKnowledge = param.params.levelOfItemKnowledge;
            }

            if (
                borderParamVals.maxLevelOfItemKnowledge === null ||
                param.params.levelOfItemKnowledge > borderParamVals.maxLevelOfItemKnowledge
            ) {
                borderParamVals.maxLevelOfItemKnowledge = param.params.levelOfItemKnowledge;
            }

            if (
                borderParamVals.minItemDifficulty === null ||
                param.params.itemDifficulty < borderParamVals.minItemDifficulty
            ) {
                borderParamVals.minItemDifficulty = param.params.itemDifficulty;
            }

            if (
                borderParamVals.maxItemDifficulty === null ||
                param.params.itemDifficulty > borderParamVals.maxItemDifficulty
            ) {
                borderParamVals.maxItemDifficulty = param.params.itemDifficulty;
            }
        }

        return borderParamVals;
    }

    private normalizeParams(questionIrtParams: QuestionIrtParamInfo[]): QuestionIrtParamInfo[] {
        const borderParamVals = this.determineBorderingParamValues(questionIrtParams);

        if (
            borderParamVals.minLevelOfItemKnowledge === null ||
            borderParamVals.maxLevelOfItemKnowledge === null ||
            borderParamVals.minItemDifficulty === null ||
            borderParamVals.maxItemDifficulty === null
        ) {
            FrameworkLogger.warn(
                EdgarIRTCalculationStep,
                "No border values could be determined for either level of item knowledge or item difficulty. " +
                "Normalization skipped."
            );
            return questionIrtParams;
        }

        const preNormalizationLevelOfItemKnowMin = Math.abs(borderParamVals.minLevelOfItemKnowledge!) + 1.5;

        const midNormalizationLevelOfItemKnowMin = 1.0;
        const midNormalizationLevelOfItemKnowMax =
            Math.log(borderParamVals.maxLevelOfItemKnowledge + preNormalizationLevelOfItemKnowMin) /
            Math.log(preNormalizationLevelOfItemKnowMin);

        const preNormalizationItemDifficultyMin = Math.abs(borderParamVals.minItemDifficulty!) + 1.5;

        const midNormalizationItemDifficultyMin = 1.0;
        const midNormalizationItemDifficultyMax =
            Math.log(borderParamVals.maxItemDifficulty + preNormalizationItemDifficultyMin) /
            Math.log(preNormalizationItemDifficultyMin);

        return questionIrtParams.map(param => {
            const midNormalizedLevelOfItemKnow =
                Math.log(param.params.levelOfItemKnowledge + preNormalizationLevelOfItemKnowMin) /
                Math.log(preNormalizationLevelOfItemKnowMin);
            const newLevelOfItemKnow =
                (midNormalizedLevelOfItemKnow - midNormalizationLevelOfItemKnowMin) /
                (midNormalizationLevelOfItemKnowMax - midNormalizationLevelOfItemKnowMin);

            const midNormalizedItemDiff =
                Math.log(param.params.itemDifficulty + preNormalizationItemDifficultyMin) /
                Math.log(preNormalizationItemDifficultyMin);
            const newItemDiff =
                (midNormalizedItemDiff - midNormalizationItemDifficultyMin) /
                (midNormalizationItemDifficultyMax - midNormalizationItemDifficultyMin);

            return {
                ...param,
                params: {
                    levelOfItemKnowledge: newLevelOfItemKnow,
                    itemDifficulty: newItemDiff,
                    itemGuessProbability: param.params.itemGuessProbability,
                    itemMistakeProbability: param.params.itemMistakeProbability,
                }
            };
        });
    }

    protected override async runTyped(
        stepInput: (IRCalculationResult | null)[]
    ): Promise<StepResult<IExtendedRCalculationResult>> {
        if ((stepInput[0] ?? null) === null) {
            return {
                status: "failure",
                result: null,
                reason: `Previous step returned null, but this step requires an input (in ${EdgarIRTCalculationStep.name})`,

                isCritical: this.isCritical,
            };
        }

        const calculationResult = stepInput[0]!;

        const irtParamCalculations: QuestionIrtParamInfo[] = [];

        for (const cbCalculation of calculationResult.courseBased ?? []) {
            const qTestBasedCalcs =
                calculationResult.testBased
                    .flatMap(tbc => tbc.testData.filter(td => td.idQuestion === cbCalculation.idQuestion));

            const qCalcInfo: QuestionCalcultionInfo = {
                courseBasedCalc: cbCalculation,
                testBasedCalcs: qTestBasedCalcs,
                relatedTestInstances: (
                    await StatProcessingJobBatchCache.instance.getCachedJobBatch(this.stepConfiguration.jobId)
                        ?.getTestInstancesWithQuestion(cbCalculation.idQuestion)
                ) ?? [],
            };

            irtParamCalculations.push({
                idQuestion: cbCalculation.idQuestion,
                defaultItemOffsetParam: 1.0, // TODO: should be 'calculated' as well
                params: {
                    itemDifficulty:
                        EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateItemDifficulty(qCalcInfo),

                    levelOfItemKnowledge:
                        EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateLevelOfItemKnowledge(qCalcInfo),

                    itemGuessProbability:
                        EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateItemGuessProbability(qCalcInfo),

                    itemMistakeProbability:
                        EdgarIRTCalculationStep.IRTCalculationConfiguration.calculateItemMistakeProbability(qCalcInfo),
                }
            });
        }

        return {
            status: "success",
            result: {
                ...calculationResult,
                calculatedIrtParams: this.normalizeParams(irtParamCalculations)
            },

            isCritical: this.isCritical,
            resultTTLSteps: this.resultTTL,
        };
    }
    
    @RegisterDelegateToRegistry(
        "JobStep",
        EdgarStatsProcessingConstants.CALCULATE_IRT_PARAMETERS_STEP_ENTRY
    )
    public createGeneric(stepDescriptor: JobStepDescriptor, jobConfig: IJobConfiguration, ...args: any[]): object {
        return new EdgarIRTCalculationStep(
            stepDescriptor.stepTimeoutMs,
            { jobId: jobConfig.jobId },
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL,
        );
    }
}
