export class EdgarStatsProcessingConstants {
    private static readonly REGISTRY_PREFIX = "EdgarStatsProcessing";

    public static readonly DATA_EXTRACTOR_REGISTRY_ENTRY =
        `${EdgarStatsProcessingConstants.REGISTRY_PREFIX}/DataExtractor`;

    public static readonly JOB_WORKER_REGISTRY_ENTRY =
        `${EdgarStatsProcessingConstants.REGISTRY_PREFIX}/JobWorker`;

    public static readonly DATA_PERSISTOR_REGISTRY_ENTRY =
        `${EdgarStatsProcessingConstants.REGISTRY_PREFIX}/DataPersistor`;
    
    
    public static readonly STALENESS_CHECK_STEP_ENTRY =
        `${EdgarStatsProcessingConstants.REGISTRY_PREFIX}/CheckStalenessStep`;

    public static readonly STATISTICS_CALCULATION_STEP_ENTRY =
        `${EdgarStatsProcessingConstants.REGISTRY_PREFIX}/StatisticsCalculation`;

    public static readonly JUDGE0_STATISTICS_CALCULATION_STEP_ENTRY =
        `${EdgarStatsProcessingConstants.REGISTRY_PREFIX}/Judge0StatisticsCalculation`;
}
