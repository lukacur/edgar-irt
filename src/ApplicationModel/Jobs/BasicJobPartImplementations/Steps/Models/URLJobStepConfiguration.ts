export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH";

export interface URLJobStepConfiguration {
    readonly url: string;
    readonly httpMethod: HttpMethod;
    readonly appendedHeaders: [string, string][];

    readonly headers?: [string, string][];
    readonly queryParams?: [string, string][];
    readonly body?: string | Blob | Buffer;

    readonly return: "response" | "body-text" | "body-json" | "body-buffer";
}
