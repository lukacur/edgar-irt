import { ScanInterval } from "../../../../../../AdaptiveGradingDaemon/DaemonConfig.model.js";

export class CheckIfCalculationNeededStepConfiguration {
    constructor(
        public readonly calculationsValidFor: ScanInterval,
        public readonly forceCalculation: boolean,
        public readonly databaseConnection: string,
    ) {}
}
