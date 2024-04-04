import { existsSync } from "fs";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { IRCalculationResult } from "../../../../Statistics/IRCalculationResult.js";
import { EdgarStatProcStepConfiguration } from "./EdgarStatProcStepConfiguration.js";
import { readFile, unlink, writeFile } from "fs/promises";
import { execFile } from "child_process";
import { DelayablePromise } from "../../../../../../Util/DelayablePromise.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";

export class EdgarStatProcJobStep
    extends AbstractGenericJobStep<EdgarStatProcStepConfiguration, object, IRCalculationResult> {
    constructor (
        stepTimeoutMs: number,
        stepConfiguration: EdgarStatProcStepConfiguration,
        resultTTL?: number,
    ) {
        super(stepTimeoutMs, stepConfiguration, resultTTL);
    }

    public override async runTyped(stepInput: (object | null)[]): Promise<StepResult<IRCalculationResult>> {
        const delProm = new DelayablePromise<IRCalculationResult>();
        const childProcArgs: string[] = [];

        if (stepInput[0] === null) {
            throw new Error(`Step ${EdgarStatProcJobStep.name} requires an input`);
        }

        const stepIn: object = stepInput[0];
        
        /*if (params !== null) {
            for (const paramKey in params) {
                const keyValue = params[(<keyof CalculationParams>paramKey)];
                if (keyValue !== null) {
                    childProcArgs.push(`--${paramKey}`);
                    childProcArgs.push(keyValue.toString());
                }
            }
        }*/

        let childProcJSONInput = this.stepConfiguration.inputJSONInfoAbsPath;
        let childProcJSONOutput = this.stepConfiguration.outputFile;
        const replaceRegex = /_?\d*\.json/;

        let counter = 0;
        while (existsSync(childProcJSONInput)) {
            ++counter;
            childProcJSONInput = childProcJSONInput.replace(replaceRegex, `_${counter}.json`);
        }

        counter = 0;
        while (childProcJSONOutput !== null && existsSync(childProcJSONOutput)) {
            ++counter;
            childProcJSONOutput = childProcJSONOutput.replace(replaceRegex, `_${counter}.json`);
        }

        await writeFile(
            childProcJSONInput,
            JSON.stringify([stepIn]),
            { encoding: "utf-8" }
        );

        const childProc = execFile(
            "rscript",
            [
                "--vanilla",
                `"${this.stepConfiguration.calculationScriptAbsPath}"`,
                "--inFile", `"${childProcJSONInput}"`,
                ...((this.stepConfiguration.outputFile === null) ? [] : ["--outFile", `"${childProcJSONOutput}"`]),
                // ...childProcArgs,
            ],
            { shell: true, windowsHide: true },
            async (err, scriptStdout, scriptStderr) => {
                if (err) {
                    await delProm.delayedReject(err);
                    return;
                }

                if (childProcJSONOutput === null) {
                    await delProm.delayedResolve(JSON.parse(scriptStdout));
                } else {
                    if (!existsSync(childProcJSONOutput)) {
                        delProm.delayedReject(new Error("Output file not generated. Perhaps an error occured?"));
                        return;
                    }

                    const outFileJSONContent = await readFile(
                        childProcJSONOutput,
                        { encoding: "utf-8" }
                    );

                    await delProm.delayedResolve(JSON.parse(outFileJSONContent));
                }
            }
        );

        const execTimeout = setTimeout(
            () => {
                childProc.kill("SIGINT");
                delProm.delayedReject("Calculation timed out");
            },
            this.stepTimeoutMs
        );

        try {
            const calcResult = await delProm.getWrappedPromise();
            clearTimeout(execTimeout);
    
            return {
                status: "success",
                result: calcResult,
                resultTTLSteps: this.resultTTL,
            };
        } catch (err: any) {
            clearTimeout(execTimeout);
            console.log(err);
            return {
                status: "failure",
                result: null,
                reason: (typeof(err) === "string") ? err : ('toString' in err) ? err.toString() : "Unknown",
                canRetry: true,
            };
        } finally {
            await unlink(childProcJSONInput);
            if (childProcJSONOutput !== null && existsSync(childProcJSONOutput)) {
                await unlink(childProcJSONOutput);
            }
        }
    }

    @RegisterDelegateToRegistry(
        "JobStep",
        EdgarStatsProcessingConstants.STATISTICS_CALCULATION_STEP_ENTRY
    )
    public createGeneric(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new EdgarStatProcJobStep(
            stepDescriptor.stepTimeoutMs,
            <EdgarStatProcStepConfiguration>stepDescriptor.configContent,
            stepDescriptor.resultTTL,
        );
    }
}
