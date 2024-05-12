import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { DelayablePromise } from "../../../../../../Util/DelayablePromise.js";
import { TimeoutUtil } from "../../../../../../Util/TimeoutUtil.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { IRCalculationResult } from "../../../../Statistics/IRCalculationResult.js";
import { EdgarJudge0StatProcStepConfiguration } from "./EdgarJudge0StatProcStepConfiguration.js";
import fetch, { Response, Headers } from 'node-fetch';
import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";

type Judge0Response = {
    stdout: string,
    status: { id: number, description: string },
    error?: string
};

export class EdgarJudge0StatProcJobStep
    extends AbstractGenericJobStep<EdgarJudge0StatProcStepConfiguration, object, IRCalculationResult> {
    public override async runTyped(stepInput: (object | null)[]): Promise<StepResult<IRCalculationResult>> {
        if (stepInput[0] === null) {
            throw new Error(`Step ${EdgarJudge0StatProcJobStep.name} requires an input`);
        }

        const stepIn: object = stepInput[0];
        const stepInJson = JSON.stringify([stepIn]);

        const stepInScript = await readFile(
            this.stepConfiguration.statisticsScriptPath,
            { encoding: "utf-8", flag: "r" },
        );

        const zipper = new JSZip();
        zipper.file("input.json", stepInJson);
        zipper.file(path.basename(this.stepConfiguration.statisticsScriptPath), stepInScript);
        const zipBase64: string = await zipper.generateAsync(
            { type: "base64", compression: "DEFLATE", compressionOptions: { level: 8 } }
        );

        const judge0RequestBody = {
            source_code:
                `source('./${path.basename(this.stepConfiguration.statisticsScriptPath)}')`,
            language_id: this.stepConfiguration.languageId,
            enable_network: false,
            max_file_size: 102400,
            memory_limit: 512000,
            cpu_time_limit: this.stepTimeoutMs / 1000,
            wall_time_limit: this.stepTimeoutMs / 1000,
            stdin: this.stepConfiguration.stdin,
            redirect_stderr_to_stdout: false,
            additional_files: zipBase64,
        };

        const headers = new Headers();
        headers.append('Content-Type', 'application/json');

        if (this.stepConfiguration.judge0Authentication) {
            headers.append(
                this.stepConfiguration.judge0Authentication.header,
                this.stepConfiguration.judge0Authentication.value
            );
        }

        if (this.stepConfiguration.judge0Authorization) {
            headers.append(
                this.stepConfiguration.judge0Authorization.header,
                this.stepConfiguration.judge0Authorization.value
            );
        }

        const delProm = new DelayablePromise<Response>();

        const getExecTimeout = TimeoutUtil.doTimeout(
            this.stepTimeoutMs,
            () => {
                delProm.delayedReject("Calculation timed out");
            },
        );

        fetch(
            `${this.stepConfiguration.judge0ServerAddress}/submissions?base64_encoded=false&wait=true`,
            {
                method: "POST",
                body: JSON.stringify(judge0RequestBody),
                headers,
            }
        ).then(resp => delProm.delayedResolve(resp));

        let tid: NodeJS.Timeout | null;
        try {
            const response: Response = await delProm.getWrappedPromise();
            if ((tid = getExecTimeout()) !== null) {
                clearTimeout(tid);
            } else {
                throw new Error("Timed out without promise rejection error: This should not happen");
            }

            if (!response.ok) {
                let additionalMessage: string | null = null;
                if (response.status === 422) {
                    const respBody = (await response.json()) as any;
                    additionalMessage = Object.keys(respBody)
                        .map(k => `${k}:\n${respBody[k].map((el: string) => "  " + el).join("\n")}`)
                        .join("\n\n");
                } else {
                    const respBody = (await response.json()) as any;
                    if ("error" in respBody) {
                        additionalMessage = `Error: ${respBody.error}`;
                    }
                }

                return {
                    status: "failure",
                    reason: `Judge0 returned status: ${response.status} - ${response.statusText}` +
                        `${(additionalMessage === null) ? "" : "\nInfo:\n" + additionalMessage}`,
                    result: null,
                    
                    isCritical: this.isCritical,

                    canRetry: false,
                };
            }

            const respBody = (await response.json()) as Judge0Response;
            if (respBody.error) {
                return {
                    status: "failure",
                    reason: `Judge0 returned error in response body: ${respBody.error}`,
                    result: null,
                    
                    isCritical: this.isCritical,

                    canRetry: true,
                };
            } else if (respBody.status.id !== 3) {
                return {
                    status: "failure",
                    reason: `Judge0 returned with status ${respBody.status.id} (${respBody.status.description})`,
                    result: null,

                    isCritical: this.isCritical,

                    canRetry: false,
                };
            }

            const stdoutNormalized = respBody.stdout.replace(/\\n/g, "");

            return {
                status: "success",
                result: JSON.parse(stdoutNormalized),

                isCritical: this.isCritical,

                resultTTLSteps: this.resultTTL,
            };
        } catch (err: any) {
            const msg = (err instanceof Error) ? 
                `Error: ${err.name}
Message: ${err.message}
Stack trace: ${err.stack ?? "-"}` : err.toString();

            return {
                status: "failure",
                reason:
                `Exception was thrown when calling 'fetch'
Error information:
${msg.split("\n").join("    \n")}`,
                result: null,
                isCritical: this.isCritical,
                canRetry: false,
            };
        }
    }

    @RegisterDelegateToRegistry(
        "JobStep",
        EdgarStatsProcessingConstants.JUDGE0_STATISTICS_CALCULATION_STEP_ENTRY
    )
    public createGeneric(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new EdgarJudge0StatProcJobStep(
            stepDescriptor.stepTimeoutMs,
            <EdgarJudge0StatProcStepConfiguration>stepDescriptor.configContent,
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL,
        );
    }
}
