// Type declarations for the `csrf` token helper used to generate/verify CSRF secrets alongside csurf.
declare module 'csrf' {
  type Options = {
    saltLength?: number;
    secretLength?: number;
  };

  export default class Tokens {
    constructor(options?: Options);
    secretSync(): string;
    create(secret: string): string;
    verify(secret: string, token: string): boolean;
  }
}
