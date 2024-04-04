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
    username: string;
    password: string;
} |
{
    applicationToken: string;
} |
{
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
