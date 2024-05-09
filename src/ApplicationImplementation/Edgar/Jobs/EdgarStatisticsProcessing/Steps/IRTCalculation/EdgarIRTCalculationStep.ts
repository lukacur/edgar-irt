import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { IJobConfiguration, JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { IIRTParameterCalculator, QuestionCalcultionInfo } from "../../../../../Models/IRT/IIRTParameterCalculator.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { IExtendedRCalculationResult, IRCalculationResult, QuestionIrtParamInfo } from "../../../../Statistics/IRCalculationResult.js";
import { StatProcessingJobBatchCache } from "../../StatProcessingJobBatchCache.js";
import { EdgarIRTCalculationStepConfiguration } from "./EdgarIRTCalculationStepConfiguration.js";

export class EdgarIRTCalculationStep
    extends AbstractGenericJobStep<EdgarIRTCalculationStepConfiguration, IRCalculationResult, IExtendedRCalculationResult> {

    private static readonly IRTCalculationConfiguration: IIRTParameterCalculator = {
        calculateLevelOfItemKnowledge: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            return (courseBased.incorrectPerc / courseBased.correctPerc) *
                (testBased.reduce((acc, e) => acc + e.partOfTotalSum, 0) * (testBased.length + 1)) * 10;
        },

        calculateItemDifficulty: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            return (courseBased.totalAchieved / courseBased.totalAchievable) *
                (courseBased.incorrectPerc / courseBased.correctPerc) *
                (testBased.reduce((acc, e) => acc + e.scorePercMedian, 0) * (testBased.length + 1));
        },

        calculateItemGuessProbability: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            return courseBased.correctPerc;
        },

        calculateItemMistakeProbability: (qCalcInfo: QuestionCalcultionInfo) => {
            const courseBased = qCalcInfo.courseBasedCalc;
            const testBased = qCalcInfo.testBasedCalcs;

            return courseBased.incorrectPerc;
        }
    };

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
                    await StatProcessingJobBatchCache.instance.getCachedJobBatch(this.stepConfiguration.jobId) // TODO: somehow get jobId
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
                calculatedIrtParams: irtParamCalculations
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
