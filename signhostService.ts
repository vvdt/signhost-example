/**
 * Signhost E-Signature Service
 * Complete integration with the Signhost (Evidos) API for electronic document signing.
 *
 * API Documentation: https://evidos.github.io/
 */

import crypto from "crypto";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SignhostConfig {
  apiKey: string;
  appKey: string;
  sharedSecret: string;
  /** Base URL for API calls (defaults to production) */
  baseUrl?: string;
}

export interface SignerInput {
  email: string;
  name: string;
  mobile?: string;
  /** Custom message in signing request email */
  signRequestMessage?: string;
  /** Days before sending reminder (default: 7) */
  daysToRemind?: number;
  /** Require SMS verification */
  requireSmsVerification?: boolean;
  /** Require email verification */
  requireEmailVerification?: boolean;
  /** URL to redirect signer after signing */
  returnUrl?: string;
  /** Reference identifier for this signer */
  reference?: string;
}

export interface TransactionInput {
  signers: SignerInput[];
  /** Your internal reference for this transaction */
  reference?: string;
  /** URL to receive webhook notifications */
  postbackUrl?: string;
  /** Send email notifications to signers */
  sendEmailNotifications?: boolean;
  /** Days until transaction expires (default: 60) */
  daysToExpire?: number;
}

export interface FileUploadInput {
  /** Display name shown to signer */
  displayName: string;
  /** Signer IDs mapped to their form sets */
  signerFormSets?: Record<string, string[]>;
  /** Form set definitions for signature placement */
  formSets?: Record<string, FormSetDefinition>;
}

export interface FormSetDefinition {
  [fieldName: string]: FormFieldDefinition;
}

export interface FormFieldDefinition {
  Type: "Signature" | "Check" | "SingleLine" | "MultiLine";
  Location: {
    Search?: string;
    PageNumber?: number;
    Left?: number;
    Top?: number;
    Width?: number;
    Height?: number;
  };
  Width?: number;
  Height?: number;
}

export interface SignatureLocationInput {
  /** Text marker to search for in PDF (e.g., "{{Signature}}") */
  searchText: string;
  /** Width of signature field in pixels */
  width?: number;
  /** Height of signature field in pixels */
  height?: number;
}

// API Response Types

export interface SignhostSigner {
  Id: string;
  Email: string;
  Mobile?: string;
  RequireScribble: boolean;
  RequireEmailVerification: boolean;
  RequireSmsVerification: boolean;
  SendSignRequest: boolean;
  SignRequestMessage?: string;
  DaysToRemind: number;
  ScribbleName: string;
  ScribbleNameFixed: boolean;
  SignUrl: string;
  ReturnUrl?: string;
  Reference?: string;
  SignedDateTime?: string;
  RejectDateTime?: string;
  RejectReason?: string;
  CreatedDateTime: string;
  ModifiedDateTime: string;
  Activities?: SignerActivity[];
  Context?: Record<string, unknown>;
}

export interface SignerActivity {
  Id: string;
  Activity: string;
  CreatedDateTime: string;
}

export interface SignhostTransaction {
  Id: string;
  Status: number;
  Seal: boolean;
  Reference?: string;
  PostbackUrl?: string;
  Signers: SignhostSigner[];
  CreatedDateTime?: string;
  ModifiedDateTime?: string;
  CancelledDateTime?: string;
}

export interface SignhostPostback {
  Id: string;
  Status: number;
  Checksum: string;
  Seal: boolean;
  Reference?: string;
  Signers: SignhostSigner[];
}

// ============================================================================
// Transaction Status Constants
// ============================================================================

export const TransactionStatus = {
  /** Transaction created, waiting for documents */
  WAITING_FOR_DOCUMENT: 5,
  /** Documents uploaded, waiting for signers */
  WAITING_FOR_SIGNER: 10,
  /** Transaction is being processed */
  IN_PROGRESS: 20,
  /** All signers have signed successfully */
  SIGNED: 30,
  /** A signer has rejected the document */
  REJECTED: 40,
  /** Transaction has expired */
  EXPIRED: 50,
  /** Transaction was cancelled */
  CANCELLED: 60,
  /** Transaction failed due to an error */
  FAILED: 70,
} as const;

export type TransactionStatusCode =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TransactionStatusLabels: Record<TransactionStatusCode, string> = {
  [TransactionStatus.WAITING_FOR_DOCUMENT]: "Waiting for Document",
  [TransactionStatus.WAITING_FOR_SIGNER]: "Waiting for Signer",
  [TransactionStatus.IN_PROGRESS]: "In Progress",
  [TransactionStatus.SIGNED]: "Signed",
  [TransactionStatus.REJECTED]: "Rejected",
  [TransactionStatus.EXPIRED]: "Expired",
  [TransactionStatus.CANCELLED]: "Cancelled",
  [TransactionStatus.FAILED]: "Failed",
};

// Signer Activity Codes
export const SignerActivityCode = {
  /** Invitation email sent */
  INVITATION_SENT: 101,
  /** Reminder email sent */
  REMINDER_SENT: 102,
  /** Signer received the document */
  RECEIVED: 103,
  /** Signer opened the document */
  OPENED: 201,
  /** Signer viewed all pages */
  VIEWED_ALL: 202,
  /** Signer signed the document */
  SIGNED: 203,
  /** Signer rejected the document */
  REJECTED: 301,
  /** Authentication failed */
  AUTH_FAILED: 401,
} as const;

// ============================================================================
// Signhost Service Class
// ============================================================================

export class SignhostService {
  private readonly config: Required<SignhostConfig>;

  constructor(config: SignhostConfig) {
    this.config = {
      baseUrl: config.baseUrl ?? "https://api.signhost.com/api",
      apiKey: config.apiKey,
      appKey: config.appKey,
      sharedSecret: config.sharedSecret,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private getHeaders(contentType = "application/json"): Record<string, string> {
    return {
      Authorization: `APIKey ${this.config.apiKey}`,
      Application: `APPKey ${this.config.appKey}`,
      "Content-Type": contentType,
    };
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `APIKey ${this.config.apiKey}`,
      Application: `APPKey ${this.config.appKey}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Signhost API error (${response.status}): ${errorText}`,
        response.status,
        errorText
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as T;
  }

  // --------------------------------------------------------------------------
  // Transaction Management
  // --------------------------------------------------------------------------

  /**
   * Create a new signing transaction
   *
   * @param input - Transaction configuration
   * @returns The created transaction with IDs for signers
   */
  async createTransaction(input: TransactionInput): Promise<SignhostTransaction> {
    const body = {
      Signers: input.signers.map((signer) => ({
        Email: signer.email,
        RequireScribble: true,
        RequireEmailVerification: signer.requireEmailVerification ?? true,
        RequireSmsVerification: signer.requireSmsVerification ?? false,
        Mobile: signer.mobile,
        SendSignRequest: true,
        SignRequestMessage:
          signer.signRequestMessage ??
          `Dear ${signer.name}, please review and sign this document.`,
        DaysToRemind: signer.daysToRemind ?? 7,
        ScribbleName: signer.name,
        ScribbleNameFixed: true,
        ReturnUrl: signer.returnUrl,
        Reference: signer.reference,
      })),
      SendEmailNotifications: input.sendEmailNotifications ?? true,
      Reference: input.reference,
      PostbackUrl: input.postbackUrl,
      DaysToExpire: input.daysToExpire ?? 60,
    };

    const response = await fetch(`${this.config.baseUrl}/transaction`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<SignhostTransaction>(response);
  }

  /**
   * Get transaction details
   *
   * @param transactionId - The transaction ID
   * @returns Transaction details including status and signers
   */
  async getTransaction(transactionId: string): Promise<SignhostTransaction> {
    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse<SignhostTransaction>(response);
  }

  /**
   * Start a transaction (triggers signing invitations)
   *
   * Call this after uploading all documents to begin the signing process.
   *
   * @param transactionId - The transaction ID
   */
  async startTransaction(transactionId: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}/start`,
      {
        method: "PUT",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to start transaction: ${errorText}`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Cancel a transaction
   *
   * @param transactionId - The transaction ID
   * @param sendNotifications - Send cancellation emails to signers
   * @param reason - Cancellation reason
   */
  async cancelTransaction(
    transactionId: string,
    sendNotifications = true,
    reason?: string
  ): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
        body: JSON.stringify({
          SendNotifications: sendNotifications,
          Reason: reason,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to cancel transaction: ${errorText}`,
        response.status,
        errorText
      );
    }
  }

  // --------------------------------------------------------------------------
  // File Management
  // --------------------------------------------------------------------------

  /**
   * Upload file metadata (defines signature field placement)
   *
   * This must be called before uploading the actual PDF file.
   *
   * @param transactionId - The transaction ID
   * @param fileId - Unique identifier for this file (e.g., "contract.pdf")
   * @param signerId - The signer ID who should sign this file
   * @param displayName - Name shown to signer
   * @param signatureLocation - Where to place the signature field
   */
  async uploadFileMetadata(
    transactionId: string,
    fileId: string,
    signerId: string,
    displayName: string,
    signatureLocation?: SignatureLocationInput
  ): Promise<void> {
    const body: Record<string, unknown> = {
      DisplayName: displayName,
    };

    if (signatureLocation) {
      body.Signers = {
        [signerId]: {
          FormSets: ["SignatureFormSet"],
        },
      };

      body.FormSets = {
        SignatureFormSet: {
          SignatureField: {
            Type: "Signature",
            Location: {
              Search: signatureLocation.searchText,
            },
            Width: signatureLocation.width ?? 520,
            Height: signatureLocation.height ?? 240,
          },
        },
      };
    }

    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}/file/${encodeURIComponent(fileId)}`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to upload file metadata: ${errorText}`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Upload file metadata with advanced form sets
   *
   * Use this for complex signature workflows with multiple fields.
   */
  async uploadFileMetadataAdvanced(
    transactionId: string,
    fileId: string,
    input: FileUploadInput
  ): Promise<void> {
    const body: Record<string, unknown> = {
      DisplayName: input.displayName,
    };

    if (input.signerFormSets) {
      body.Signers = Object.fromEntries(
        Object.entries(input.signerFormSets).map(([signerId, formSets]) => [
          signerId,
          { FormSets: formSets },
        ])
      );
    }

    if (input.formSets) {
      body.FormSets = input.formSets;
    }

    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}/file/${encodeURIComponent(fileId)}`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to upload file metadata: ${errorText}`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Upload the actual PDF file
   *
   * @param transactionId - The transaction ID
   * @param fileId - Must match the fileId used in uploadFileMetadata
   * @param pdfBuffer - The PDF file as a buffer
   */
  async uploadFile(
    transactionId: string,
    fileId: string,
    pdfBuffer: Buffer
  ): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}/file/${encodeURIComponent(fileId)}`,
      {
        method: "PUT",
        headers: this.getHeaders("application/pdf"),
        body: pdfBuffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to upload PDF file: ${errorText}`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Download a document (signed or unsigned)
   *
   * @param transactionId - The transaction ID
   * @param fileId - The file ID
   * @returns The PDF file as a buffer
   */
  async downloadDocument(transactionId: string, fileId: string): Promise<Buffer> {
    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}/file/${encodeURIComponent(fileId)}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to download document: ${errorText}`,
        response.status,
        errorText
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Download the signing receipt
   *
   * The receipt contains audit trail information about the signing process.
   *
   * @param transactionId - The transaction ID
   * @returns The receipt PDF as a buffer
   */
  async downloadReceipt(transactionId: string): Promise<Buffer> {
    const response = await fetch(
      `${this.config.baseUrl}/transaction/${transactionId}/receipt`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new SignhostError(
        `Failed to download receipt: ${errorText}`,
        response.status,
        errorText
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // --------------------------------------------------------------------------
  // Webhook / Postback Handling
  // --------------------------------------------------------------------------

  /**
   * Validate a postback checksum for security
   *
   * Always validate postbacks before processing to ensure they come from Signhost.
   *
   * @param transactionId - Transaction ID from postback
   * @param status - Status from postback
   * @param receivedChecksum - Checksum from postback
   * @returns True if checksum is valid
   */
  validatePostbackChecksum(
    transactionId: string,
    status: number,
    receivedChecksum: string
  ): boolean {
    // Checksum = SHA1(transactionId + || + status + | + sharedSecret)
    const data = `${transactionId}||${status}|${this.config.sharedSecret}`;
    const expectedChecksum = crypto.createHash("sha1").update(data).digest("hex");

    return expectedChecksum.toLowerCase() === receivedChecksum.toLowerCase();
  }

  /**
   * Parse and validate a postback payload
   *
   * @param body - Raw postback body
   * @returns Validated postback data or null if invalid
   */
  parsePostback(body: unknown): SignhostPostback | null {
    if (!body || typeof body !== "object") {
      return null;
    }

    const postback = body as SignhostPostback;

    if (!postback.Id || typeof postback.Status !== "number" || !postback.Checksum) {
      return null;
    }

    const isValid = this.validatePostbackChecksum(
      postback.Id,
      postback.Status,
      postback.Checksum
    );

    return isValid ? postback : null;
  }

  /**
   * Get human-readable status label
   */
  getStatusLabel(status: number): string {
    return TransactionStatusLabels[status as TransactionStatusCode] ?? `Unknown (${status})`;
  }

  /**
   * Check if transaction is in a final state
   */
  isTransactionComplete(status: number): boolean {
    const finalStatuses: readonly number[] = [
      TransactionStatus.SIGNED,
      TransactionStatus.REJECTED,
      TransactionStatus.EXPIRED,
      TransactionStatus.CANCELLED,
      TransactionStatus.FAILED,
    ];
    return finalStatuses.includes(status);
  }
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class SignhostError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = "SignhostError";
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a configured Signhost service instance
 */
export function createSignhostService(config: SignhostConfig): SignhostService {
  return new SignhostService(config);
}
