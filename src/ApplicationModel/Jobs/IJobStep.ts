export interface IJobStep {
    readonly stepTimeoutMs: number;
    readonly stepConfiguration: object;

    run(stepInput: object | null): Promise<object | null>;
}
