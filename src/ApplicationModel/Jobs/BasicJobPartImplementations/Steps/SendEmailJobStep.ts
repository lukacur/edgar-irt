import { RegistryDefaultConstants } from "../../../../PluginSupport/RegistryDefault.constants.js";
import { ArraysUtil } from "../../../../Util/ArraysUtil.js";
import { ErrorUtil } from "../../../../Util/ErrorUtil.js";
import { IMailer, MailerProvider } from "../../../../Util/MailerProvider.js";
import { RegisterDelegateToRegistry } from "../../../Decorators/Registration.decorator.js";
import { SmtpConfiguration } from "../../../FrameworkConfiguration/IJobAutomatizationFrameworkConfiguration.js";
import { EmailBody, EmailHeader } from "../../../Models/Email/EmailModels.model.js";
import { AbstractGenericJobStep } from "../../AbstractGenericJobStep.js";
import { JobStepDescriptor } from "../../IJobConfiguration.js";
import { StepResult } from "../../IJobStep.js";

type SendEmailConfiguration = SmtpConfiguration;

type SendEmailRequest = {
    header: Partial<Omit<EmailHeader, "from">>;
    body: EmailBody;
};

export class SendEmailJobStep extends AbstractGenericJobStep<SendEmailConfiguration, SendEmailRequest, object> {
    private readonly mailer: IMailer;

    constructor(
        stepTimeoutMs: number,
        configContent: SendEmailConfiguration,
        resultTTL?: number
    ) {
        super(stepTimeoutMs, configContent, resultTTL);

        if (!MailerProvider.instance.hasMailer()) {
            throw new Error(`No mailer service was registered in the ${MailerProvider.name} singleton instance`);
        }

        this.mailer = MailerProvider.instance.getMailer().withUser(this.stepConfiguration.credentials);
    }

    protected async runTyped(stepInput: (SendEmailRequest | null)[]): Promise<StepResult<object>> {
        if (stepInput[0] === undefined || stepInput[0] === null) {
            return {
                status: "failure",
                reason:
                    `Input object of type SendEmailRequest must be provided as step input for ${SendEmailJobStep.name}`,
                result: null,
                resultTTLSteps: this.resultTTL,
            }
        }

        const stepEmailConfig = stepInput[0];

        try {
            const toArr = stepEmailConfig.header.to ?? [];
            if (toArr.length === 0) {
                toArr.push(...(this.stepConfiguration.defaults.to));
            }
            toArr.push(...(this.stepConfiguration.always.to ?? []));
            const mailHeader: EmailHeader = {
                from: this.stepConfiguration.defaults.from,
                subject: stepEmailConfig.header.subject ?? this.stepConfiguration.defaults.subject,
                to: ArraysUtil.populateArray(
                        stepEmailConfig.header.to,
                        this.stepConfiguration.defaults.to,
                        this.stepConfiguration.always.to
                    ),
                cc: ArraysUtil.populateArray(
                        stepEmailConfig.header.cc,
                        this.stepConfiguration.defaults.cc,
                        this.stepConfiguration.always.cc
                    ),
                bcc: ArraysUtil.populateArray(
                        stepEmailConfig.header.bcc,
                        this.stepConfiguration.defaults.bcc,
                        this.stepConfiguration.always.bcc
                    ),
            };
            
            const success = await this.mailer.sendMail(
                {
                    header: mailHeader,
                    body: stepEmailConfig.body
                },
                false
            );

            if (!success) {
                return {
                    status: "failure",
                    reason: `Mailer ${this.mailer.constructor.name} returned 'false' when sendMail was attempted`,
                    result: null,
                };
            }

            return {
                status: "success",
                result: null,
            }
        } catch (err) {
            return {
                status: "failure",
                reason: `An error occured while sending email:\n${ErrorUtil.getErrorDetailedInfo(err, 4)}`,
                result: null,
            };
        }
    }

    @RegisterDelegateToRegistry(
        "JobStep",
        RegistryDefaultConstants.jobSteps.SEND_EMAIL,
    )
    public create(descriptor: JobStepDescriptor, ...args: any[]): object {
        return new SendEmailJobStep(
            descriptor.stepTimeoutMs,
            <SendEmailConfiguration>descriptor.configContent,
            descriptor.resultTTL,
        );
    }
}
