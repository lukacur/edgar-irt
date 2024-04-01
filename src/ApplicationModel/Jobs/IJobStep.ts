export type StepResult<TResult> =
    {
        result: TResult | null;
        /**
         * Defines the result TTL. Values can be:
         *   - undefined - ttl is efectively 0, meaning the result will be removed after the next step is done
         *   - -1 - ttl is infinite, meaning the result will persist until the worker is disposed of
         *   - > 0 - the result will stay in the worker's step input pipeline until the number of tasks that have seen
         *           this result (input) is equal to the value set in this property
         */
        resultTTLSteps?: number;
    } &
    (
        {
            status: "success";
        } |
        (
            {
                reason: string;
            } &
            (
                {
                    status: "cancelChain";
                } |
                {
                    status: "noRetry";
                } |
                {
                    status: "failure";
                    canRetry?: boolean;
                    retryAfterMs?: number;
                }
            )
        )
    );

export function getStepResultDBEnumValue<TRes extends object>(stepResult: StepResult<TRes> | null): string {
    if (stepResult === null) {
        return "CRITICALLY_ERRORED";
    }

    switch (stepResult.status) {
        case "success": return "SUCCESS";
        case "cancelChain": return "SKIP_CHAIN";
        case "noRetry":
        case "failure": return "FAILURE";

        default: throw new Error("Not yet implemented");
    }
}


export interface IJobStep {
    stepRunId: string;
    readonly stepTimeoutMs: number;
    readonly stepConfiguration: object;

    run(stepInput: (object | null)[]): Promise<StepResult<object>>;
}
