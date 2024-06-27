import { DaemonConfig } from "../ApplicationModel/Daemon/DaemonConfig.model.js";

export type CalculationConfig =
{
    useJudge0: true,
    endpoint: string,
    langId: number,
    stdin: string,

    statisticsScriptPath: string,

    authentication?: { header: string, value: string },
    authorization?: { header: string, value: string },
} |
{
    useJudge0: false,
    scriptPath: string,
    outputFile: string,
    generatedJSONInputPath: string,
};

export interface AdaptiveGradingDaemonConfig extends DaemonConfig {
    calculationConfig: CalculationConfig;
    statisticsCalculationSchemaName: string;
}
