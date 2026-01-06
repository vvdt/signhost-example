/**
 * Contract PDF Builder using PDFKit
 * Generates a professional contract document with headers, numbered items,
 * and signature placeholders for e-signature integration.
 */

import PDFDocument from "pdfkit";

// ============================================================================
// Types
// ============================================================================

export interface ContractData {
  // Client Information
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientEmail: string;

  // Provider Information
  providerName: string;
  providerAddress: string;
  providerCity: string;

  // Contract Details
  contractNumber: string;
  effectiveDate: string;
  projectDescription: string;
  paymentAmount: number;
  paymentTerms: string;
}

export interface ContractSection {
  title: string;
  items: string[];
}

export interface PdfOptions {
  /** Include invisible signature markers for e-signature placement */
  includeSignatureMarkers?: boolean;
  /** Custom margins in points (72 points = 1 inch) */
  margin?: number;
  /** Page size */
  pageSize?: "A4" | "LETTER";
}

// ============================================================================
// PDF Builder Class
// ============================================================================

export class ContractPdfBuilder {
  private doc: PDFKit.PDFDocument;
  private data: ContractData;
  private options: Required<PdfOptions>;

  constructor(data: ContractData, options: PdfOptions = {}) {
    this.data = data;
    this.options = {
      includeSignatureMarkers: options.includeSignatureMarkers ?? true,
      margin: options.margin ?? 72,
      pageSize: options.pageSize ?? "A4",
    };

    this.doc = new PDFDocument({
      margin: this.options.margin,
      size: this.options.pageSize,
      bufferPages: true,
    });
  }

  /**
   * Generate the complete contract PDF
   */
  public async build(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);

      try {
        this.renderHeader();
        this.renderPreamble();
        this.renderSections();
        this.renderSignatureBlock();
        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Render the contract title/header
   */
  private renderHeader(): void {
    this.doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("SERVICE AGREEMENT", { align: "center" });

    this.doc.moveDown(0.5);

    this.doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Contract No: ${this.data.contractNumber}`, { align: "center" });

    this.doc.fillColor("#000000").moveDown(2);
  }

  /**
   * Render the preamble with party information
   */
  private renderPreamble(): void {
    this.doc.fontSize(11).font("Helvetica");

    this.doc.text(
      `This Service Agreement ("Agreement") is entered into as of ${this.data.effectiveDate} by and between:`
    );

    this.doc.moveDown();

    // Client party
    this.doc.font("Helvetica-Bold").text(this.data.clientName);
    this.doc.font("Helvetica").text(this.data.clientAddress);
    this.doc.text(this.data.clientCity);
    this.doc.text(`Email: ${this.data.clientEmail}`);
    this.doc.font("Helvetica-Oblique").text("(hereinafter referred to as the \"Client\")");

    this.doc.moveDown();
    this.doc.font("Helvetica").text("and", { align: "center" });
    this.doc.moveDown();

    // Provider party
    this.doc.font("Helvetica-Bold").text(this.data.providerName);
    this.doc.font("Helvetica").text(this.data.providerAddress);
    this.doc.text(this.data.providerCity);
    this.doc.font("Helvetica-Oblique").text("(hereinafter referred to as the \"Provider\")");

    this.doc.moveDown(2);

    this.doc
      .font("Helvetica")
      .text(
        "NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, " +
          "and for other good and valuable consideration, the receipt and sufficiency of which are hereby " +
          "acknowledged, the parties agree as follows:"
      );

    this.doc.moveDown(2);
  }

  /**
   * Render all contract sections with numbered items
   */
  private renderSections(): void {
    const sections = this.buildSections();

    let sectionNumber = 1;
    for (const section of sections) {
      this.renderSection(sectionNumber, section);
      sectionNumber++;
    }
  }

  /**
   * Build the contract sections based on contract data
   */
  private buildSections(): ContractSection[] {
    return [
      {
        title: "SCOPE OF SERVICES",
        items: [
          `The Provider agrees to perform the following services: ${this.data.projectDescription}`,
          "All services shall be performed in a professional and workmanlike manner consistent with industry standards.",
          "The Provider shall dedicate sufficient resources and qualified personnel to complete the services in a timely manner.",
          "Any changes to the scope of services must be agreed upon in writing by both parties.",
        ],
      },
      {
        title: "COMPENSATION",
        items: [
          `The Client agrees to pay the Provider a total amount of €${this.data.paymentAmount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} (excluding VAT) for the services described herein.`,
          `Payment terms: ${this.data.paymentTerms}`,
          "All invoices shall be paid within thirty (30) days of receipt unless otherwise specified.",
          "Late payments shall accrue interest at a rate of 1.5% per month or the maximum rate permitted by law, whichever is lower.",
        ],
      },
      {
        title: "TERM AND TERMINATION",
        items: [
          "This Agreement shall commence on the Effective Date and shall continue until all services have been completed and accepted by the Client.",
          "Either party may terminate this Agreement for convenience upon thirty (30) days prior written notice to the other party.",
          "Either party may terminate this Agreement immediately upon written notice if the other party materially breaches any provision of this Agreement and fails to cure such breach within fifteen (15) days of receiving written notice thereof.",
          "Upon termination, the Client shall pay the Provider for all services satisfactorily rendered up to the date of termination.",
        ],
      },
      {
        title: "CONFIDENTIALITY",
        items: [
          "Each party agrees to maintain the confidentiality of any proprietary or confidential information received from the other party during the term of this Agreement.",
          "Confidential information shall not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was rightfully in the receiving party's possession prior to disclosure; or (c) is independently developed by the receiving party.",
          "This confidentiality obligation shall survive the termination of this Agreement for a period of three (3) years.",
        ],
      },
      {
        title: "INTELLECTUAL PROPERTY",
        items: [
          "All intellectual property rights in any work product created by the Provider specifically for the Client under this Agreement shall be assigned to the Client upon full payment.",
          "The Provider retains all rights to pre-existing materials, tools, and methodologies used in performing the services.",
          "The Provider grants the Client a non-exclusive, perpetual license to use any pre-existing materials incorporated into the deliverables.",
        ],
      },
      {
        title: "LIMITATION OF LIABILITY",
        items: [
          "Neither party shall be liable to the other for any indirect, incidental, special, consequential, or punitive damages arising out of or related to this Agreement.",
          `The Provider's total aggregate liability under this Agreement shall not exceed the total amount paid by the Client under this Agreement.`,
          "The limitations set forth in this section shall not apply to breaches of confidentiality obligations or gross negligence or willful misconduct.",
        ],
      },
      {
        title: "GENERAL PROVISIONS",
        items: [
          "This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior negotiations, representations, or agreements relating thereto.",
          "This Agreement shall be governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of laws principles.",
          "Any disputes arising out of or in connection with this Agreement shall be submitted to the exclusive jurisdiction of the courts of Amsterdam, the Netherlands.",
          "Any amendments or modifications to this Agreement must be made in writing and signed by both parties.",
          "If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
        ],
      },
    ];
  }

  /**
   * Render a single section with its numbered items
   */
  private renderSection(sectionNumber: number, section: ContractSection): void {
    // Check if we need a new page (if less than 100 points remaining)
    if (this.doc.y > this.doc.page.height - this.options.margin - 100) {
      this.doc.addPage();
    }

    // Section title
    this.doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`${sectionNumber}. ${section.title}`);

    this.doc.moveDown(0.5);

    // Section items
    this.doc.fontSize(11).font("Helvetica");

    let itemNumber = 1;
    for (const item of section.items) {
      const itemLabel = `${sectionNumber}.${itemNumber}`;

      this.doc.text(`${itemLabel}  ${item}`, {
        indent: 25,
        align: "justify",
        lineGap: 2,
      });

      this.doc.moveDown(0.5);
      itemNumber++;
    }

    this.doc.moveDown(0.5);
  }

  /**
   * Render the signature block at the end of the contract
   */
  private renderSignatureBlock(): void {
    // Ensure signature block starts on a page with enough space (need more space for stacked signatures)
    if (this.doc.y > this.doc.page.height - this.options.margin - 400) {
      this.doc.addPage();
    }

    this.doc.moveDown(2);

    this.doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        "IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the date first written above.",
        { align: "justify" }
      );

    this.doc.moveDown(3);

    const pageWidth =
      this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
    const signatureWidth = pageWidth * 0.75; // 75% of page width
    const leftX = this.doc.page.margins.left;

    // Client signature block (first, full width)
    const clientStartY = this.doc.y;
    this.renderSignatureRow(
      leftX,
      clientStartY,
      signatureWidth,
      "CLIENT",
      this.data.clientName,
      "{{ClientSignature}}"
    );

    // Move Y position past client signature block
    this.doc.y = clientStartY + 170;

    // Provider signature block (below client)
    const providerStartY = this.doc.y;
    this.renderSignatureRow(
      leftX,
      providerStartY,
      signatureWidth,
      "PROVIDER",
      this.data.providerName,
      "{{ProviderSignature}}"
    );

    // Move Y position past provider signature block
    this.doc.y = providerStartY + 140;
  }

  /**
   * Render a single signature row (full width, stacked vertically)
   */
  private renderSignatureRow(
    x: number,
    y: number,
    width: number,
    label: string,
    name: string,
    signatureMarker: string
  ): void {


    this.doc.fontSize(10).font("Helvetica");
    this.doc.text(label, x, y, { width });

    // Signature marker (invisible - for e-signature placement)
    // This is just a search anchor for Signhost - the actual signature field size
    // is controlled by Width/Height parameters in the Signhost API call.
    // We use a small font and no width constraint to avoid layout issues.
    if (this.options.includeSignatureMarkers) {
      this.doc.fontSize(1).fillColor("#ffffff"); // Tiny invisible text - just for detection
      this.doc.text(signatureMarker, x, y + 25); // No width constraint
      this.doc.fillColor("#000000");
    }

    // Leave space for the signature (increased from 60 to 85)
    const lineY = y + 85;
    this.doc
      .moveTo(x, lineY)
      .lineTo(x + width - 20, lineY)
      .stroke();

    // Name and title below the line
    this.doc.fontSize(10).font("Helvetica");
    this.doc.text(`Name: ${name}`, x, lineY + 8, { width });
    this.doc.text("Title: _______________________", x, lineY + 23, { width });
    this.doc.text("Date: _______________________", x, lineY + 38, { width });
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Generate a contract PDF buffer
 * @param data - Contract data to populate the template
 * @param options - PDF generation options
 * @returns Promise<Buffer> - The generated PDF as a buffer
 */
export async function generateContractPdf(
  data: ContractData,
  options?: PdfOptions
): Promise<Buffer> {
  const builder = new ContractPdfBuilder(data, options);
  return builder.build();
}
