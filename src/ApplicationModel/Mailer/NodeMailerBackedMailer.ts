import Mail from "nodemailer/lib/mailer/index.js";
import { IMailer } from "../../Util/MailerProvider.js";
import { SmtpConfiguration } from "../FrameworkConfiguration/IJobAutomatizationFrameworkConfiguration.js";
import { EmailInfo, SmtpCredentials } from "../Models/Email/EmailModels.model.js";
import * as nodemailer from 'nodemailer';

type CustomMailMessage =
    ({ html?: string } | { text?: string }) & { attachments?: Mail.Attachment[] } & { [key: string]: any };

export class NodeMailerBackedMailer implements IMailer {
    private readonly nMailer: nodemailer.Transporter;

    constructor(
        private readonly configuration: SmtpConfiguration,
    ) {
        let auth: { username: string, password: string } | { token: string } | { clientId: string };
        switch (configuration.credentials.type) {
            case "un-pass": {
                auth = {
                    username: configuration.credentials.username,
                    password: configuration.credentials.password,
                };

                break;
            }

            case "app-token": {
                auth = {
                    token: configuration.credentials.applicationToken,
                };

                break;
            }

            case "cert": {
                auth = {
                    clientId: configuration.credentials.certificateBase64,
                };

                break;
            }

            default: {
                throw new Error("Not implemented");
            }
        }

        this.nMailer = nodemailer.createTransport(
            {
                host: configuration.host,
                port: configuration.port,
                secure: configuration.useTls,
                auth: {
                    ...(auth as {})
                },

                dnsTimeout: configuration.timeoutMs,
                socketTimeout: configuration.timeoutMs,
                greetingTimeout: configuration.timeoutMs,
                connectionTimeout: configuration.timeoutMs,
            },
            {
                from: this.configuration.defaults.from,
                to: this.configuration.defaults.to,
                cc: this.configuration.defaults.cc,
                bcc: this.configuration.defaults.bcc,
                subject: this.configuration.defaults.subject
            }
        );
    }

    private buildAlwaysObject(): { to: string[], cc: string[], bcc: string[] } {
        return {
            to: this.configuration.always.to ?? [],
            cc: this.configuration.always.cc ?? [],
            bcc: this.configuration.always.bcc ?? [],
        };
    }

    public async sendMail(info: EmailInfo, useDefaults: boolean, additionalParams: object): Promise<boolean> {
        const alwaysObject = this.buildAlwaysObject();
        alwaysObject.to.push(...info.header.to);
        alwaysObject.cc.push(...(info.header.cc ?? []));
        alwaysObject.bcc.push(...(info.header.bcc ?? []));

        const message: CustomMailMessage = {
            from: info.header.from,
            to: alwaysObject.to,
            cc: alwaysObject.cc,
            bcc: alwaysObject.bcc,
            subject: info.header.subject,
        };

        if (info.body.type === "html") {
            message.html = info.body.content;
        } else if (info.body.type === "plain") {
            message.text = info.body.content;
        } else {
            throw new Error(`Unsupported email body type ${info.body['type']}`);
        }

        if ((info.body.attachments ?? null) !== null) {
            message.attachments = await Promise.all(
                info.body.attachments?.map(async (att) => {
                    if ("base64Content" in att) {
                        const attachment: Mail.Attachment = {
                            content: Buffer.from(att.base64Content, 'base64'),
                        };

                        return attachment;
                    } else if (att instanceof Blob) {
                        return {
                            content: Buffer.from(await att.arrayBuffer())
                        };
                    }

                    return {
                        content: att,
                    };
                }) ?? []
            );
        }

        try {
            await this.nMailer.sendMail(message);
            return true;
        } catch (err) {
            console.log(err);
        }

        return false;
    }

    withUser(credentials: SmtpCredentials): IMailer {
        throw new Error("Method not implemented.");
    }
    
}
