import { AbstractGenericJobStep } from "../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { EdgarStatProcStepConfiguration } from "./EdgarStatProcStepConfiguration.js";

export class EdgarStatProcJobStep extends AbstractGenericJobStep<EdgarStatProcStepConfiguration> {
    constructor (
        stepTimeoutMs: number,
        stepConfiguration: EdgarStatProcStepConfiguration,
    ) {
        super(stepTimeoutMs, stepConfiguration);
    }
}
