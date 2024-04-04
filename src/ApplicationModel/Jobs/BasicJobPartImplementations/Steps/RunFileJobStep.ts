import { execFile } from "child_process";
import { RegistryDefaultConstants } from "../../../../PluginSupport/RegistryDefault.constants.js";
import { RegisterDelegateToRegistry } from "../../../Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../IJobConfiguration.js";
import { StepResult } from "../../IJobStep.js";
import { DelayablePromise } from "../../../../Util/DelayablePromise.js";
import { readFile, unlink } from "fs/promises";
import { ErrorUtil } from "../../../../Util/ErrorUtil.js";

type ProgramCallResultSource =
{
    type: "stdout";
} |
{
    type: "file";
    location: string;
    cleanupResultFile: boolean;
};

type RunFileConfiguration = {
    fileOrProgram: string;
    arguments: [string, string?][];

    resultSource: ProgramCallResultSource;
} & 
(
    {
        waitForExecution: true;
        executionTimeoutMs: number;
    } |
    {
        waitForExecution: false;
    }
);

type RunFileResultType = "text" | "buffer" | "json";

type RunFileRequest = {
    resultType: RunFileResultType;
};

type RunFileResult =
{
    type: RunFileResultType & "text";
    executionResult: string;
} |
{
    type: RunFileResultType & "buffer";
    executionResult: Buffer;
} |
{
    type: RunFileResultType & "json";
    executionResult: object;
};

export class RunFileJobStep extends AbstractGenericJobStep<RunFileConfiguration, RunFileRequest, RunFileResult> {
    protected async runTyped(stepInput: (RunFileRequest | null)[]): Promise<StepResult<RunFileResult>> {
        const resType = stepInput[0]?.resultType ?? "buffer";
        if (stepInput[0] === undefined || stepInput[0] === null) {
            console.log(
                `[WARN]: Step input for ${RunFileJobStep.name} is undefined or null; returning result as Buffer`
            );
        }

        const delProm = new DelayablePromise<string | Buffer | object>();

        const childProc = execFile(
            this.stepConfiguration.fileOrProgram,
            this.stepConfiguration.arguments.flatMap(argSet => {
                if (argSet[1] === undefined) {
                    return [argSet[0]];
                }

                return <[string, string]>argSet;
            }),
            { shell: true, windowsHide: true },
            async (err, progStdout, scriptStderr) => {
                if (err) {
                    await delProm.delayedReject(err);
                    return;
                }

                switch (this.stepConfiguration.resultSource.type) {
                    case "stdout": {
                        switch (resType) {
                            case "text": {
                                delProm.delayedResolve(progStdout);
                                break;
                            }

                            case "buffer": {
                                delProm.delayedResolve(Buffer.from(progStdout));
                                break;
                            }

                            case "json": {
                                delProm.delayedResolve(JSON.parse(progStdout));
                                break;
                            }

                            default: {
                                delProm.delayedReject(new Error("Not implemented"));
                            }
                        }
                        break;
                    }

                    case "file": {
                        switch (resType) {
                            case "text": {
                                delProm.delayedResolve(
                                    await readFile(
                                        this.stepConfiguration.resultSource.location,
                                        { encoding: "utf-8", flag: "r" }
                                    )
                                );
                                break;
                            }

                            case "buffer": {
                                delProm.delayedResolve(
                                    await readFile(
                                        this.stepConfiguration.resultSource.location,
                                        { flag: "r" }
                                    )
                                );
                                break;
                            }

                            case "json": {
                                delProm.delayedResolve(
                                    JSON.parse(
                                        await readFile(
                                            this.stepConfiguration.resultSource.location,
                                            { encoding: "utf-8", flag: "r" }
                                        )
                                    )
                                );
                                break;
                            }

                            default: {
                                delProm.delayedReject(new Error("Not implemented"));
                            }
                        }
                        break;
                    }

                    default: {
                        delProm.delayedReject(new Error("Not implemented"));
                    }
                }
            }
        );

        let execTimeout: NodeJS.Timeout | null = null;
        try {
            if (!this.stepConfiguration.waitForExecution) {
                return {
                    status: "success",
                    result: null,
                    resultTTLSteps: this.resultTTL,
                };
            }

            execTimeout = setTimeout(
                () => {
                    childProc.kill("SIGINT");
                    delProm.delayedReject("Program or step timed out");
                },
                Math.min(this.stepTimeoutMs, this.stepConfiguration.executionTimeoutMs ?? this.stepTimeoutMs)
            );

            const calcResult = await delProm.getWrappedPromise();
            clearTimeout(execTimeout);
    
            return {
                status: "success",
                result: {
                    type: resType,
                    executionResult: <any>calcResult,
                },
                resultTTLSteps: this.resultTTL,
            };
        } catch (err: any) {
            if (execTimeout !== null) {
                clearTimeout(execTimeout);
            }

            console.log(err);
            return {
                status: "failure",
                result: null,
                reason: "Job step execution failed with error:\n    " + ErrorUtil.getErrorDetailedInfo(err, 4),
            };
        } finally {
            if (
                this.stepConfiguration.resultSource.type === "file" &&
                    this.stepConfiguration.resultSource.cleanupResultFile
            ) {
                await unlink(this.stepConfiguration.resultSource.location);
            }
        }
    }

    @RegisterDelegateToRegistry(
        "JobStep",
        RegistryDefaultConstants.jobSteps.RUN_FILE,
    )
    public create(descriptor: JobStepDescriptor, ...args: any[]): object {
        return new RunFileJobStep(
            descriptor.stepTimeoutMs,
            <RunFileConfiguration>descriptor.configContent,
            descriptor.resultTTL,
        )
    }
}
