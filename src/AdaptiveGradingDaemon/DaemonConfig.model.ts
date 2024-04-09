import { IDatabaseConfig } from "../ApplicationImplementation/Models/Config/DatabaseConfig.model.js";
import { HttpMethod } from "../ApplicationModel/Jobs/BasicJobPartImplementations/Steps/Models/URLJobStepConfiguration.js";

export type ScanInterval = {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
};

export type DaemonOptions = {
    waitForActionCompletion: boolean;
    actionProgress: { reportActionProgress: boolean, noReports: number };
};

export type QueueDescriptor =
    {
        queueName: string;
    } &
    (
        {
            type: "file";
            location: string;
        } |
        {
            type: "dir";
            location: string;

            prefix: string;
            name: string;
            suffix: string;
        } |
        {
            type: "pg_boss";
            connectionString?: string;
            configuration?: IDatabaseConfig;
        }
    );

export interface DaemonConfig {
    scanInterval: ScanInterval;

    calculationConfig: {
        useJudge0: true,
        endpoint: string,
        method: HttpMethod,
    } |
    {
        useJudge0: false,
        scriptPath: string,
        outputFile: string,
        generatedJSONInputPath: string,
    },

    maxJobTimeoutMs?: number;

    declaredQueues: QueueDescriptor[];
    statisticsCalculationSchemaName: string;
}
