import { ScanInterval } from "../../../../../../ApplicationModel/Daemon/DaemonConfig.model.js";

export class CheckIfCalculationNeededStepConfiguration {
    constructor(
        public readonly calculationsValidFor: ScanInterval,
        public readonly forceCalculation: boolean,
        public readonly databaseConnection: string,
    ) {}
}
