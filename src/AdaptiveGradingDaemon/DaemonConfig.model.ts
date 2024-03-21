import { IDatabaseConfig } from "../ApplicationImplementation/Models/Config/DatabaseConfig.model.js";

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
    declaredQueues: QueueDescriptor[];
}
