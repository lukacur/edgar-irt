export type StepResult<TResult> =
    {
        result: TResult | null;
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

    run(stepInput: object | null): Promise<StepResult<object>>;
}
