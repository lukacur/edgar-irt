type ScanInterval = {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
};

export type DaemonOptions = {
    waitForActionCompletion: boolean;
    actionProgress: { reportActionProgress: boolean, noReports: number };
};

export interface DaemonConfig {
    scanInterval: ScanInterval;
}
