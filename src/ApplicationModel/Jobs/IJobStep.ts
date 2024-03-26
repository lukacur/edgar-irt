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
        {
            status: "cancelChain";
            reason: string;
        } |
        {
            status: "failure";
            reason: string;
            canRetry?: boolean;
            retryAfterMs?: number;
        }
    );


export interface IJobStep {
    readonly stepTimeoutMs: number;
    readonly stepConfiguration: object;

    run(stepInput: (object | null)[]): Promise<StepResult<object>>;
}
