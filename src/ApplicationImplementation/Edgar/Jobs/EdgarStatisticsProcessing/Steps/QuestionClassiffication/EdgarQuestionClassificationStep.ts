import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { IExtendedRCalculationResult, QuestionClassification, QuestionIrtParamInfo } from "../../../../Statistics/IRCalculationResult.js";
import { EdgarQuestionClassificationStepConfiguration } from "./EdgarQuestionClassificationStepConfiguration.js";

export class EdgarQuestionClassificationStep
    extends AbstractGenericJobStep<EdgarQuestionClassificationStepConfiguration, IExtendedRCalculationResult, IExtendedRCalculationResult> {
    private getClassificationFor(irtInfo: QuestionIrtParamInfo): QuestionClassification {
        if (irtInfo.params.itemGuessProbability > 0.7) {
            return "easy";
        }

        if (irtInfo.params.itemDifficulty > 0.6 && irtInfo.params.levelOfItemKnowledge > 0.7) {
            return "very_hard";
        }

        if (irtInfo.params.itemDifficulty > 0.4 && irtInfo.params.levelOfItemKnowledge > 0.5) {
            return "hard";
        }

        if (irtInfo.params.itemDifficulty > 0.2 && irtInfo.params.levelOfItemKnowledge > 0.1) {
            return "normal";
        }

        if (irtInfo.params.itemMistakeProbability > 0.6) {
            return "hard";
        }

        if (irtInfo.params.levelOfItemKnowledge < 0.1 || irtInfo.params.itemDifficulty < 0.2) {
            return "very_easy"
        }

        throw new Error("Unable to classify question");
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

        for (const irtInfo of input.calculatedIrtParams) {
            irtInfo.questionClassification = this.getClassificationFor(irtInfo);
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
