var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { readFile } from "fs/promises";
import JSZip from "jszip";
import path from "path";
import { EdgarStatsProcessingConstants } from "../../dist/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { AbstractGenericJobStep } from "../../dist/ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { DelayablePromise } from "../../dist/Util/DelayablePromise.js";
import { TimeoutUtil } from "../../dist/Util/TimeoutUtil.js";
import { Headers } from "node-fetch";
import fetch from "node-fetch";

export class EdgarJudge0StatProcJobStep extends AbstractGenericJobStep {
    runTyped(stepInput) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (stepInput[0] === null) {
                throw new Error(`Step ${EdgarJudge0StatProcJobStep.name} requires an input`);
            }
            const stepIn = stepInput[0];
            const stepInJson = JSON.stringify([stepIn]);
            const stepInScript = yield readFile(this.stepConfiguration.statisticsScriptPath, { encoding: "utf-8", flag: "r" });
            const zipper = new JSZip();
            zipper.file("input.json", stepInJson);
            zipper.file(path.basename(this.stepConfiguration.statisticsScriptPath), stepInScript);
            const zipBase64 = yield zipper.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 8 } });
            const judge0RequestBody = {
                source_code: `source('./${path.basename(this.stepConfiguration.statisticsScriptPath)}')`,
                language_id: this.stepConfiguration.languageId,
                enable_network: false,
                max_file_size: 102400,
                memory_limit: 2097152,
                cpu_time_limit: this.stepTimeoutMs / 1000,
                wall_time_limit: this.stepTimeoutMs / 1000,
                stdin: this.stepConfiguration.stdin,
                redirect_stderr_to_stdout: false,
                additional_files: zipBase64,
            };
            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            if (this.stepConfiguration.judge0Authentication) {
                headers.append(this.stepConfiguration.judge0Authentication.header, this.stepConfiguration.judge0Authentication.value);
            }
            if (this.stepConfiguration.judge0Authorization) {
                headers.append(this.stepConfiguration.judge0Authorization.header, this.stepConfiguration.judge0Authorization.value);
            }
            const delProm = new DelayablePromise();
            const getExecTimeout = TimeoutUtil.doTimeout(this.stepTimeoutMs, () => {
                delProm.delayedReject("Calculation timed out");
            });
            fetch(`${this.stepConfiguration.judge0ServerAddress}/submissions?base64_encoded=false&wait=true`, {
                method: "POST",
                body: JSON.stringify(judge0RequestBody),
                headers,
            }).then(resp => delProm.delayedResolve(resp));
            let tid;
            try {
                const response = yield delProm.getWrappedPromise();
                if ((tid = getExecTimeout()) !== null) {
                    clearTimeout(tid);
                }
                else {
                    throw new Error("Timed out without promise rejection error: This should not happen");
                }
                if (!response.ok) {
                    let additionalMessage = null;
                    if (response.status === 422) {
                        const respBody = (yield response.json());
                        additionalMessage = Object.keys(respBody)
                            .map(k => `${k}:\n${respBody[k].map((el) => "  " + el).join("\n")}`)
                            .join("\n\n");
                    }
                    else {
                        const respBody = (yield response.json());
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
                const respBody = (yield response.json());
                if (respBody.error) {
                    return {
                        status: "failure",
                        reason: `Judge0 returned error in response body: ${respBody.error}`,
                        result: null,
                        isCritical: this.isCritical,
                        canRetry: true,
                    };
                }
                else if (respBody.status.id !== 3) {
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
            }
            catch (err) {
                const msg = (err instanceof Error) ?
                    `Error: ${err.name}
Message: ${err.message}
Stack trace: ${(_a = err.stack) !== null && _a !== void 0 ? _a : "-"}` : err.toString();
                return {
                    status: "failure",
                    reason: `Exception was thrown when calling 'fetch'
Error information:
${msg.split("\n").join("    \n")}`,
                    result: null,
                    isCritical: this.isCritical,
                    canRetry: false,
                };
            }
        });
    }
}
const impl = {
    namespace: EdgarStatsProcessingConstants.JUDGE0_STATISTICS_CALCULATION_STEP_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.JUDGE0_STATISTICS_CALCULATION_STEP_ENTRY.split("/")[1],
    registry: "JobStep",
    creationFunction(stepDescriptor, ...args) {
        return new EdgarJudge0StatProcJobStep(stepDescriptor.stepTimeoutMs, stepDescriptor.configContent, stepDescriptor.isCritical, stepDescriptor.resultTTL);
    }
};
export default impl;
