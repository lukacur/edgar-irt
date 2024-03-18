export interface IJobStep {
    readonly stepTimeoutMs: number;
    readonly stepConfiguration: object;

    // setJobInput(jobInput: object): Promise<boolean>;
}
