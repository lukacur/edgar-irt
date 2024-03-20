import { AbstractGenericJobStep } from "../../AbstractGenericJobStep.js";
import { StepResult } from "../../IJobStep.js";

interface URLStepConfiguration {
    readonly httpMethod: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH";
    readonly url: URL;

    readonly body: BodyInit | null | undefined;
    readonly headers: HeadersInit | undefined;
}

export class URLRequestJobStep
    extends AbstractGenericJobStep<URLStepConfiguration, URLStepConfiguration, Response> {
    public async runTyped(stepInput: URLStepConfiguration | null): Promise<StepResult<Response>> {
        stepInput ??= this.stepConfiguration;

        try {
            const result = await fetch(
                stepInput.url,
                {
                    method: stepInput.httpMethod,
                    body: stepInput.body,
                    headers: stepInput.headers,
                },
            );

            return {
                status: "success",
                result,
            };
        } catch (err: any) {
            console.log(err);
            return {
                status: "failure",
                result: null,
                reason: (typeof(err) === "string") ? err : ('toString' in err) ? err.toString() : "Unknown",
                canRetry: true,
            };
        }
    }
}
