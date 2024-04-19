export interface IStartJobRequest<TRequest> {
    readonly idJobType: number;

    readonly jobName?: string | null;
    readonly userNote?: string | null;
    readonly periodical: boolean;
    readonly idUserRequested?: number | null;

    readonly jobMaxTimeoutMs?: number;

    readonly request: TRequest;
}
