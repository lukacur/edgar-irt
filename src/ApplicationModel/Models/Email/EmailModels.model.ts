export type AttachmentInfo = { base64Content: string } | Blob | Buffer;

export type EmailBody =
{
    content: string;
    attachments?: AttachmentInfo[]
} &
(
    {
        type: "html";
    } |
    {
        type: "plain";
    }
);

export type SmtpCredentials =
{
    type: "un-pass";
    username: string;
    password: string;
} |
{
    type: "app-token";
    applicationToken: string;
} |
{
    type: "cert";
    certificateBase64: string;
};

export type EmailHeader = {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
};

export type EmailInfo = {
    header: EmailHeader;
    body: EmailBody;
};
