import { RegisterDelegateToRegistry } from "../../../../../../ApplicationModel/Decorators/Registration.decorator.js";
import { AbstractGenericJobStep } from "../../../../../../ApplicationModel/Jobs/AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../../../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { StepResult } from "../../../../../../ApplicationModel/Jobs/IJobStep.js";
import { GenericFactory } from "../../../../../../PluginSupport/GenericFactory.js";
import { DatabaseConnectionRegistry } from "../../../../../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { DatabaseConnection } from "../../../../../Database/DatabaseConnection.js";
import { EdgarStatsProcessingConstants } from "../../../../EdgarStatsProcessing.constants.js";
import { CheckIfCalculationNeededStepConfiguration } from "./CheckIfCalculationNeededStepConfiguration.js";

export class CheckIfCalculationNeededStep
    extends AbstractGenericJobStep<CheckIfCalculationNeededStepConfiguration, object, object>
    implements GenericFactory {
    constructor(
        stepTimeoutMs: number,
        stepConfiguration: CheckIfCalculationNeededStepConfiguration,

        private readonly dbConn: DatabaseConnection,

        resultTTL?: number,
    ) {
        super(stepTimeoutMs, stepConfiguration, resultTTL);
    }

    private createSQLIntervalFromConfig(): string {
        return `${this.stepConfiguration.calculationsValidFor.days ?? 0} days ` +
                `${this.stepConfiguration.calculationsValidFor.hours ?? 0} hours ` +
                `${this.stepConfiguration.calculationsValidFor.minutes ?? 0} minutes ` +
                `${this.stepConfiguration.calculationsValidFor.seconds ?? 0} seconds`;
    }

    protected async runTyped(stepInput: (object | null)[]): Promise<StepResult<object>> {
        const inputEl = stepInput[0];
        if (inputEl === null || inputEl === undefined) {
            return {
                status: "failure",
                reason: `Input to this step can't be null ${CheckIfCalculationNeededStep.name}`,
                result: null,
                canRetry: false,
            }
        }

        if (
            !("id" in inputEl && "idStartAcademicYear" in inputEl && "numberOfIncludedPreviousYears" in inputEl)
        ) {
            return {
                status: "cancelChain",
                reason: "Input is in an invalid format",
                result: null,
            };
        }

        const validinputEl =
            inputEl as { id: number, idStartAcademicYear: number, numberOfIncludedPreviousYears: number };
        

        const result = await this.dbConn.doQuery<{ existance: boolean }>(
            `SELECT EXISTS (
                SELECT
                FROM statistics_schema.question_param_calculation
                    JOIN statistics_schema.question_param_calculation_academic_year
                        ON statistics_schema.question_param_calculation.id =
                            statistics_schema.question_param_calculation_academic_year.id_question_param_calculation
                WHERE id_based_on_course = $1 AND
                        id_academic_year BETWEEN (CAST($2 AS INT) - CAST($3 AS INT)) AND $2 AND
                        created_on >= (CURRENT_TIMESTAMP - CAST('${this.createSQLIntervalFromConfig()}' AS INTERVAL))

            ) AS existance`,
            [
                /* $1 */ validinputEl.id,
                /* $2 */ validinputEl.idStartAcademicYear.toString(),
                /* $3 */ validinputEl.numberOfIncludedPreviousYears.toString(),
                /* $4 */ 
            ]
        );
        
        if (result !== null && result.count !== 0 && result.rows[0].existance) {
            return {
                status: "cancelChain",
                reason: `Calculation already exists and is not older than ${this.createSQLIntervalFromConfig()}`,
                result: null,
            };
        }
        
        return {
            status: "success",
            result: inputEl,
            resultTTLSteps: this.resultTTL,
        };
    }

    @RegisterDelegateToRegistry(
        "JobStep",
        EdgarStatsProcessingConstants.STALENESS_CHECK_STEP_ENTRY
    )
    public create(stepDescriptor: JobStepDescriptor, ...args: any[]): object {
        const config: { databaseConnection?: string } | undefined = stepDescriptor?.configContent;

        if (config?.databaseConnection === undefined) {
            throw new Error("Database connection is required but was not provided in the step descriptor");
        }

        return new CheckIfCalculationNeededStep(
            stepDescriptor.stepTimeoutMs,
            <CheckIfCalculationNeededStepConfiguration>stepDescriptor.configContent,
            DatabaseConnectionRegistry.instance.getItem(config.databaseConnection),
            stepDescriptor.resultTTL,
        );
    }
}
