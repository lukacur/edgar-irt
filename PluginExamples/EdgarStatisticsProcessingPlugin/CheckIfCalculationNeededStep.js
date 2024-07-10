var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EdgarStatsProcessingConstants } from "../../dist/ApplicationImplementation/Edgar/EdgarStatsProcessing.constants.js";
import { AbstractGenericJobStep } from "../../dist/ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { FrameworkLogger } from "../../dist/Logger/FrameworkLogger.js";
import { DatabaseConnectionRegistry } from "../../dist/PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
export class CheckIfCalculationNeededStep extends AbstractGenericJobStep {
    constructor(stepTimeoutMs, stepConfiguration, dbConn, isCritical, resultTTL) {
        super(stepTimeoutMs, stepConfiguration, isCritical, resultTTL);
        this.dbConn = dbConn;
    }
    createSQLIntervalFromConfig() {
        var _a, _b, _c, _d;
        return `${(_a = this.stepConfiguration.calculationsValidFor.days) !== null && _a !== void 0 ? _a : 0} days ` +
            `${(_b = this.stepConfiguration.calculationsValidFor.hours) !== null && _b !== void 0 ? _b : 0} hours ` +
            `${(_c = this.stepConfiguration.calculationsValidFor.minutes) !== null && _c !== void 0 ? _c : 0} minutes ` +
            `${(_d = this.stepConfiguration.calculationsValidFor.seconds) !== null && _d !== void 0 ? _d : 0} seconds`;
    }
    runTyped(stepInput) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputEl = stepInput[0];
            if (inputEl === null || inputEl === undefined) {
                return {
                    status: "failure",
                    reason: `Input to this step can't be null ${CheckIfCalculationNeededStep.name}`,
                    isCritical: this.isCritical,
                    result: null,
                    canRetry: false,
                };
            }
            if (!("id" in inputEl && "idStartAcademicYear" in inputEl && "numberOfIncludedPreviousYears" in inputEl)) {
                return {
                    status: "cancelChain",
                    reason: "Input is in an invalid format",
                    isCritical: this.isCritical,
                    result: null,
                };
            }
            const validinputEl = inputEl;
            const result = yield this.dbConn.doQuery(`SELECT EXISTS (
                SELECT
                FROM statistics_schema.question_param_calculation
                    JOIN statistics_schema.question_param_calculation_academic_year
                        ON statistics_schema.question_param_calculation.id =
                            statistics_schema.question_param_calculation_academic_year.id_question_param_calculation
                WHERE id_based_on_course = $1
                GROUP BY id_based_on_course, created_on
                HAVING created_on >= (CURRENT_TIMESTAMP - CAST('${this.createSQLIntervalFromConfig()}' AS INTERVAL)) AND
                        MIN(id_academic_year) = CAST($2 AS INT) - CAST($3 AS INT) AND
                        MAX(id_academic_year) = CAST($2 AS INT)

            ) AS existance`, [
                /* $1 */ validinputEl.id,
                /* $2 */ validinputEl.idStartAcademicYear.toString(),
                /* $3 */ validinputEl.numberOfIncludedPreviousYears.toString(),
            ]);
            if (result !== null && result.count !== 0 && result.rows[0].existance) {
                return {
                    status: "cancelChain",
                    reason: `Calculation already exists and is not older than ${this.createSQLIntervalFromConfig()}`,
                    isCritical: this.isCritical,
                    result: null,
                };
            }
            return {
                status: "success",
                result: inputEl,
                isCritical: this.isCritical,
                resultTTLSteps: this.resultTTL,
            };
        });
    }
}
const impl = {
    namespace: EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY.split("/")[0],
    name: EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY.split("/")[1],
    registry: "JobStep",
    creationFunction(stepDescriptor, ...args) {
        const config = stepDescriptor === null || stepDescriptor === void 0 ? void 0 : stepDescriptor.configContent;
        if ((config === null || config === void 0 ? void 0 : config.databaseConnection) === undefined) {
            throw new Error("Database connection is required but was not provided in the step descriptor");
        }
        const dbConn = DatabaseConnectionRegistry.instance.getItem(config.databaseConnection);
        if (dbConn === null) {
            FrameworkLogger.error(CheckIfCalculationNeededStep, "Unable to fetch database connection");
            throw new Error("Unable to fetch database connection");
        }
        return new CheckIfCalculationNeededStep(stepDescriptor.stepTimeoutMs, stepDescriptor.configContent, dbConn, stepDescriptor.isCritical, stepDescriptor.resultTTL);
    }
};
export default impl;
