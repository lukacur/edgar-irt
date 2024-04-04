import { existsSync } from "fs";
import { AbstractGenericJobStep } from "../../AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../IJobConfiguration.js";
import { StepResult } from "../../IJobStep.js";
import { writeFile } from "fs/promises";

type SaveInputToFileConfiguration = {
    path: string;
    overwriteIfPresent: boolean;
    passInputAsOutput: boolean;
};

export class SaveInputToFileJobStep
    extends AbstractGenericJobStep<SaveInputToFileConfiguration, object | Buffer, object> {
    protected async runTyped(stepInput: ((object | Buffer) | null)[]): Promise<StepResult<object>> {
        if (existsSync(this.stepConfiguration.path) && !this.stepConfiguration.overwriteIfPresent) {
            return {
                status: "failure",
                reason: `File ${this.stepConfiguration.path} already exists`,
                result: null,
                isCritical: this.isCritical,
            };
        }

        const writeEmpty = stepInput[0] === null || stepInput[0] === undefined;
        const data = (writeEmpty) ? "" :
            (
                (Buffer.isBuffer(stepInput[0])) ?
                    stepInput[0] :
                    JSON.stringify(stepInput[0])
            );

        try {
            await writeFile(
                this.stepConfiguration.path,
                data
            );

            return {
                status: "success",
                result: (this.stepConfiguration.passInputAsOutput) ? stepInput[0] : null,
                isCritical: this.isCritical,
                resultTTLSteps: this.resultTTL,
            };
        } catch (err: any) {
            const message: string = (err instanceof Error) ?
            `Error: ${err.name}
Message: ${err.message}
Trace: ${err.stack ?? "-"}` : (("toString" in err) ? err.toString() : "Unknown error");

            return {
                status: "failure",
                reason: "An error occured while writing object to file: " +
                `Message:
    ${message.split("\n").join("\n    ")}`,
                result: null,
                isCritical: this.isCritical,
            };
        }
    }
    
    public create(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new SaveInputToFileJobStep(
            stepDescriptor.stepTimeoutMs,
            <SaveInputToFileConfiguration>stepDescriptor.configContent,
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL,
        );
    }
}
