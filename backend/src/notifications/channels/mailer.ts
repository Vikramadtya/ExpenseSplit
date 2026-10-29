export interface Email {
  to: string;
  subject: string;
  text: string;
}

export abstract class Mailer {
  abstract send(email: Email): Promise<void>;
}
