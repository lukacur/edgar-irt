import { IDatabaseConfig } from "../ApplicationImplementation/Models/Config/DatabaseConfig.model.js";
import { HttpMethod } from "../ApplicationModel/Jobs/BasicJobPartImplementations/Steps/Models/URLJobStepConfiguration.js";
import { IStartJobRequest } from "../ApplicationModel/Models/IStartJobRequest.js";

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

export type CalculationConfig =
{
    useJudge0: true,
    endpoint: string,
    langId: number,
    stdin: string,

    authentication?: { header: string, value: string },
    authorization?: { header: string, value: string },
} |
{
    useJudge0: false,
    scriptPath: string,
    outputFile: string,
    generatedJSONInputPath: string,
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
    resultStalenessInterval: ScanInterval;
    calculationRefreshInterval: ScanInterval;
    recalculationCheckInterval: ScanInterval;

    autoJobStartInfo: {
        interval: ScanInterval;
        jobRequestQueue: string;
        startJobRequest: IStartJobRequest<any>;
        restartIntervalWithNewRequest: boolean;
    }

    calculationConfig: CalculationConfig;

    maxJobTimeoutMs?: number;

    maxAllowedConcurrentCalculations?: number;

    incomingWorkRequestQueue: QueueDescriptor;
    jobRunnerWorkingQueue: QueueDescriptor;

    statisticsCalculationSchemaName: string;
}
