import { IDatabaseConfig } from "../Database/DatabaseConfig.model.js";
import { IStartJobRequest } from "../Models/IStartJobRequest.js";

export type ScanInterval = {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
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
    };

    maxJobTimeoutMs?: number;

    maxAllowedConcurrentCalculations?: number;

    incomingWorkRequestQueue: QueueDescriptor;
    jobRunnerWorkingQueue: QueueDescriptor;
}
