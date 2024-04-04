import { RegistryDefaultConstants } from "../../../../PluginSupport/RegistryDefault.constants.js";
import { RegisterDelegateToRegistry } from "../../../Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../IJobConfiguration.js";
import { StepResult } from "../../IJobStep.js";
import { URLJobStepConfiguration } from "./Models/URLJobStepConfiguration.js";

type URLFetchResultType = { result: string | object | Buffer };

export class URLRequestJobStep
    extends AbstractGenericJobStep<URLJobStepConfiguration, Partial<URLJobStepConfiguration>, URLFetchResultType> {

    protected async runTyped(
        stepInput: (Partial<URLJobStepConfiguration> | null)[]
    ): Promise<StepResult<URLFetchResultType>> {
        const inputConfig = stepInput[0] ?? this.stepConfiguration;
        const hdrs = (inputConfig.headers ?? this.stepConfiguration.headers ?? []);
        hdrs.push(...this.stepConfiguration.appendedHeaders);

        const headers = new Headers();
        hdrs.forEach(hdr => { headers.append(hdr[0], hdr[1]); });

        try {
            const response = await fetch(
                inputConfig.url ?? this.stepConfiguration.url,
                {
                    method: inputConfig.httpMethod ?? this.stepConfiguration.httpMethod,
                    body: inputConfig.body ?? this.stepConfiguration.body,
                    headers,
                }
            );

            let responseDataResult: any = response;
            switch (this.stepConfiguration.return) {
                case "body-text": {
                    responseDataResult = await response.text();
                    break;
                }

                case "body-json": {
                    responseDataResult = await response.json();
                    break;
                }

                case "body-buffer": {
                    responseDataResult = response.body;
                    break;
                }
            }

            return {
                status: "success",
                result: {
                    result: responseDataResult,
                },
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
        RegistryDefaultConstants.jobSteps.URL_INPUT_FETCH,
    )
    public create(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        return new URLRequestJobStep(
            stepDescriptor.stepTimeoutMs,
            <URLJobStepConfiguration>stepDescriptor.configContent,
            stepDescriptor.isCritical,
            stepDescriptor.resultTTL,
        );
    }
}
