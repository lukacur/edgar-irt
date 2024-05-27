import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { IExtendedRCalculationResult, QuestionClassification, QuestionIrtParamInfo } from "../../../../Statistics/IRCalculationResult.js";
import { QuestionClassificationUtil } from "../../Util/QuestionClassificationUtil.js";
import { EdgarQuestionClassificationStepConfiguration } from "./EdgarQuestionClassificationStepConfiguration.js";

type ClassificationBounds = {
    [classification in QuestionClassification]: {
        itKnow: [number, number];
        itDiff: [number, number];
        guessProb: [number, number];
        mistProb: [number, number];
    }
};

type BoundType = "inclusive" | "exclusive";

export class EdgarQuestionClassificationStep
    extends AbstractGenericJobStep<EdgarQuestionClassificationStepConfiguration, IExtendedRCalculationResult, IExtendedRCalculationResult> {
    private static inBounds(value: number, bounds: [number, number], boundTypes: [BoundType, BoundType]): boolean {
        if (bounds[0] > bounds[1]) {
            throw new Error("Invalid bound definition");
        }

        const lowerOk = (boundTypes[0] === "inclusive") ? value >= bounds[0] : value > bounds[0];
        const upperOk = (boundTypes[1] === "inclusive") ? value <= bounds[1] : value < bounds[1];

        return lowerOk && upperOk;
    }

    private static readonly DEFAULT_BOUND_CHANGE = 0.04;

    private getClassificationFor(
        irtInfo: QuestionIrtParamInfo,
        numberOfQuestionsToClassify: number,
        previousClassifictions: { [classification in QuestionClassification]: number },
        classificationBounds: ClassificationBounds,
    ): QuestionClassification {
        let itKnowClass: QuestionClassification | null = null;
        let itDiffClass: QuestionClassification | null = null;
        let guessProbClass: QuestionClassification | null = null;
        let mistProbClass: QuestionClassification | null = null;

        const params = irtInfo.params;

        for (const classification of (Object.keys(classificationBounds) as QuestionClassification[])) {
            if (itKnowClass !== null && itDiffClass !== null && guessProbClass !== null && mistProbClass !== null) {
                break;
            }

            const lowestClass = QuestionClassificationUtil.instance.isLowestClass(classification);
            const highestClass = QuestionClassificationUtil.instance.isHighestClass(classification);
            const classBounds = classificationBounds[classification];

            const itKnowInBounds = EdgarQuestionClassificationStep.inBounds(
                params.levelOfItemKnowledge, 
                classBounds.itKnow,
                ["inclusive", highestClass ? "inclusive" : "exclusive"],
            );

            if (
                itKnowClass === null &&
                (itKnowInBounds || highestClass && params.levelOfItemKnowledge > classBounds.itKnow[1])
            ) {
                itKnowClass = classification;
            }

            const itDiffInBounds = EdgarQuestionClassificationStep.inBounds(
                params.itemDifficulty, 
                classBounds.itDiff,
                ["inclusive", highestClass ? "inclusive" : "exclusive"],
            );

            if (
                itDiffClass === null &&
                (itDiffInBounds || highestClass && params.itemDifficulty > classBounds.itDiff[1])
            ) {
                itDiffClass = classification;
            }

            const guessProbInBounds = EdgarQuestionClassificationStep.inBounds(
                params.itemGuessProbability,
                classBounds.guessProb,
                ["inclusive", lowestClass ? "inclusive" : "exclusive"],
            );

            if (
                guessProbClass === null &&
                (guessProbInBounds || lowestClass && params.itemGuessProbability > classBounds.guessProb[1])
            ) {
                guessProbClass = classification;
            }

            const mistProbInBounds = EdgarQuestionClassificationStep.inBounds(
                params.itemMistakeProbability,
                classBounds.mistProb,
                ["inclusive", highestClass ? "inclusive" : "exclusive"],
            );

            if (
                mistProbClass === null &&
                (mistProbInBounds || highestClass && params.itemMistakeProbability > classBounds.mistProb[1])
            ) {
                mistProbClass = classification;
            }
        }

        let lowestCountingClass: QuestionClassification | null = null;
        let lowestCountingCount: number | null = null;
        for (const classKey of (Object.keys(previousClassifictions) as QuestionClassification[])) {
            if (lowestCountingClass === null || lowestCountingCount! > previousClassifictions[classKey]) {
                lowestCountingClass = classKey;
                lowestCountingCount = previousClassifictions[classKey];
            }
        }

        const avgQuestionDifficulty = QuestionClassificationUtil.instance.getAverageDifficulty(
            [
                itKnowClass ?? lowestCountingClass!,
                itDiffClass ?? lowestCountingClass!,
                guessProbClass ?? lowestCountingClass!,
                mistProbClass ?? lowestCountingClass!,
            ]
        );

        const classifiedBoundInfo = classificationBounds[avgQuestionDifficulty];
        if (!QuestionClassificationUtil.instance.isLowestClass(avgQuestionDifficulty)) {
            classifiedBoundInfo.itKnow[0] +=
            (
                ((classifiedBoundInfo.itKnow[1] - classifiedBoundInfo.itKnow[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.itDiff[0] +=
            (
                ((classifiedBoundInfo.itDiff[1] - classifiedBoundInfo.itDiff[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.guessProb[1] -=
            (
                ((classifiedBoundInfo.guessProb[1] - classifiedBoundInfo.guessProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.mistProb[0] +=
            (
                ((classifiedBoundInfo.mistProb[1] - classifiedBoundInfo.mistProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );
        }

        if (!QuestionClassificationUtil.instance.isHighestClass(avgQuestionDifficulty)) {
            classifiedBoundInfo.itKnow[1] -=
            (
                ((classifiedBoundInfo.itKnow[1] - classifiedBoundInfo.itKnow[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.itDiff[1] -=
            (
                ((classifiedBoundInfo.itDiff[1] - classifiedBoundInfo.itDiff[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.guessProb[0] +=
            (
                ((classifiedBoundInfo.guessProb[1] - classifiedBoundInfo.guessProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );

            classifiedBoundInfo.mistProb[1] -=
            (
                ((classifiedBoundInfo.mistProb[1] - classifiedBoundInfo.mistProb[0]) >
                    EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE) ?
                (EdgarQuestionClassificationStep.DEFAULT_BOUND_CHANGE / 2) : 0
            );
        }

        return avgQuestionDifficulty;
    }

    protected async runTyped(
        stepInput: (IExtendedRCalculationResult | null)[]
    ): Promise<StepResult<IExtendedRCalculationResult>> {
        if ((stepInput[0] ?? null) === null) {
            return {
                status: "failure",
                reason: "This step requires an input, but no input was provided" +
                    ` (${EdgarQuestionClassificationStep.name})`,
                result: null,

                isCritical: this.isCritical,
            };
        }

        const input = stepInput[0]!;
        const classificationObj: { [classification in QuestionClassification]: number } = {
            very_easy: 0,
            easy: 0,
            normal: 0,
            hard: 0,
            very_hard: 0,
        };

        const classificationBounds: ClassificationBounds = {
            very_easy: { itKnow: [0.0, 0.15], itDiff: [0.0, 0.15], guessProb: [0.85, 1.0], mistProb: [0.0, 0.15], },
            easy: { itKnow: [0.15, 0.35], itDiff: [0.15, 0.35], guessProb: [0.65, 0.85], mistProb: [0.15, 0.35], },
            normal: { itKnow: [0.35, 0.65], itDiff: [0.35, 0.65], guessProb: [0.35, 0.65], mistProb: [0.35, 0.65], },
            hard: { itKnow: [0.65, 0.85], itDiff: [0.65, 0.85], guessProb: [0.15, 0.35], mistProb: [0.65, 0.85], },
            very_hard: { itKnow: [0.85, 1.0], itDiff: [0.85, 1.0], guessProb: [0.0, 0.15], mistProb: [0.85, 1.0], },
        };

        for (const irtInfo of input.calculatedIrtParams) {
            irtInfo.questionClassification = this.getClassificationFor(
                irtInfo,
                input.calculatedIrtParams.length,
                classificationObj,
                classificationBounds,
            );

            if ((classificationObj[irtInfo.questionClassification] ?? null) === null) {
                classificationObj[irtInfo.questionClassification] = 0;
            }

            classificationObj[irtInfo.questionClassification]++;
        }

        return {
            status: "success",
            result: input,

            isCritical: this.isCritical,
            resultTTLSteps: this.resultTTL,
        };
    }
    
    @RegisterDelegateToRegistry(
        "JobStep",
        EdgarStatsProcessingConstants.CLASSIFY_QUESTION_STEP_ENTRY
    )
    createGeneric(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new EdgarQuestionClassificationStep(
            stepDescriptor.stepTimeoutMs,
            <EdgarQuestionClassificationStepConfiguration>stepDescriptor.configContent,
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL
        );
    }
}
