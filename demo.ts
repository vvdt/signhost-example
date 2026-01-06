#!/usr/bin/env npx ts-node
/**
 * Signhost Contract Signing Demo
 *
 * This script demonstrates the complete flow:
 * 1. Generate a contract PDF using PDFKit
 * 2. Create a Signhost transaction
 * 3. Upload the PDF for signing
 * 4. Start the signing process
 *
 * Usage:
 *   npx ts-node demo.ts
 *
 * Or make executable:
 *   chmod +x demo.ts
 *   ./demo.ts
 *
 * Requirements:
 *   npm install pdfkit @types/pdfkit typescript ts-node
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import { generateContractPdf, ContractData } from "./contractPdfBuilder";
import {
  createSignhostService,
  SignhostService,
  TransactionStatus,
  TransactionStatusLabels,
} from "./signhostService";

// ============================================================================
// CONFIGURATION - Loaded from .env file
// ============================================================================

const CONFIG = {
  // Signhost API Credentials
  SIGNHOST_API_KEY: process.env.SIGNHOST_API_KEY || "",
  SIGNHOST_APP_KEY: process.env.SIGNHOST_APP_KEY || "",
  SIGNHOST_SHARED_SECRET: process.env.SIGNHOST_SHARED_SECRET || "",

  // Webhook URL for receiving signing status updates (optional)
  POSTBACK_URL: process.env.POSTBACK_URL || "",

  // Where to save generated PDFs locally (for inspection)
  OUTPUT_DIR: process.env.OUTPUT_DIR || "./output",

  // Demo mode: if true, saves PDF locally without sending to Signhost
  DEMO_MODE: process.env.DEMO_MODE === "true",
};

// ============================================================================
// SAMPLE DATA - Loaded from .env file
// ============================================================================

const SAMPLE_CONTRACT: ContractData = {
  // Client (the person who will sign)
  clientName: process.env.CLIENT_NAME || "",
  clientAddress: process.env.CLIENT_ADDRESS || "",
  clientCity: process.env.CLIENT_CITY || "",
  clientEmail: process.env.CLIENT_EMAIL || "",

  // Provider (your company)
  providerName: process.env.PROVIDER_NAME || "",
  providerAddress: process.env.PROVIDER_ADDRESS || "",
  providerCity: process.env.PROVIDER_CITY || "",

  // Contract details
  contractNumber: `CONTRACT-${Date.now()}`,
  effectiveDate: new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  projectDescription:
    "Development and implementation of a custom web application including " +
    "design, development, testing, and deployment phases as detailed in " +
    "the project specification document dated " +
    new Date().toLocaleDateString("en-GB"),
  paymentAmount: 25000,
  paymentTerms:
    "50% upon signing, 25% upon completion of development phase, " +
    "25% upon final delivery and acceptance",
};

const SAMPLE_SIGNER = {
  email: process.env.SIGNER_EMAIL || "",
  name: process.env.SIGNER_NAME || "",
  mobile: process.env.SIGNER_MOBILE || "",
};

// ============================================================================
// MAIN DEMO SCRIPT
// ============================================================================

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           Signhost Contract Signing Demo                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();

  // Validate configuration
  if (!CONFIG.DEMO_MODE && CONFIG.SIGNHOST_API_KEY === "YOUR_API_KEY_HERE") {
    console.error("❌ Error: Please configure your Signhost API credentials in the CONFIG section.");
    console.error("   Set DEMO_MODE = true to generate a PDF without sending to Signhost.");
    process.exit(1);
  }

  try {
    // Step 1: Generate PDF
    console.log("📄 Step 1: Generating contract PDF...");
    const pdfBuffer = await generateContractPdf(SAMPLE_CONTRACT, {
      includeSignatureMarkers: true,
      pageSize: "A4",
    });
    console.log(`   ✓ PDF generated (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

    // Save PDF locally for inspection
    await ensureOutputDir();
    const localPdfPath = path.join(CONFIG.OUTPUT_DIR, `${SAMPLE_CONTRACT.contractNumber}.pdf`);
    fs.writeFileSync(localPdfPath, pdfBuffer);
    console.log(`   ✓ PDF saved to: ${localPdfPath}`);

    if (CONFIG.DEMO_MODE) {
      console.log();
      console.log("🎭 Demo mode enabled - skipping Signhost integration.");
      console.log("   Open the generated PDF to inspect the contract.");
      console.log();
      printContractSummary();
      return;
    }

    // Step 2: Initialize Signhost service
    console.log();
    console.log("🔐 Step 2: Connecting to Signhost...");
    const signhost = createSignhostService({
      apiKey: CONFIG.SIGNHOST_API_KEY,
      appKey: CONFIG.SIGNHOST_APP_KEY,
      sharedSecret: CONFIG.SIGNHOST_SHARED_SECRET,
    });
    console.log("   ✓ Signhost service initialized");

    // Step 3: Create transaction
    console.log();
    console.log("📝 Step 3: Creating signing transaction...");
    const transaction = await signhost.createTransaction({
      signers: [
        {
          email: SAMPLE_SIGNER.email,
          name: SAMPLE_SIGNER.name,
          mobile: SAMPLE_SIGNER.mobile,
          signRequestMessage: `Dear ${SAMPLE_SIGNER.name},\n\nPlease review and sign the attached Service Agreement.\n\nBest regards,\n${SAMPLE_CONTRACT.providerName}`,
          daysToRemind: 3,
          requireEmailVerification: true,
          requireSmsVerification: false,
        },
      ],
      reference: SAMPLE_CONTRACT.contractNumber,
      postbackUrl: CONFIG.POSTBACK_URL || undefined,
      sendEmailNotifications: true,
      daysToExpire: 30,
    });

    const transactionId = transaction.Id;
    const signerId = transaction.Signers[0].Id;
    const signUrl = transaction.Signers[0].SignUrl;

    console.log(`   ✓ Transaction created: ${transactionId}`);
    console.log(`   ✓ Signer ID: ${signerId}`);

    // Step 4: Upload file metadata
    console.log();
    console.log("📎 Step 4: Configuring signature placement...");
    const fileId = "contract.pdf";
    await signhost.uploadFileMetadata(
      transactionId,
      fileId,
      signerId,
      "Service Agreement",
      {
        searchText: "{{ClientSignature}}",
        width: 300,
        height: 140,
      }
    );
    console.log("   ✓ Signature field configured");

    // Step 5: Upload PDF
    console.log();
    console.log("📤 Step 5: Uploading contract PDF...");
    await signhost.uploadFile(transactionId, fileId, pdfBuffer);
    console.log("   ✓ PDF uploaded successfully");

    // Step 6: Start transaction
    console.log();
    console.log("🚀 Step 6: Starting signing process...");
    await signhost.startTransaction(transactionId);
    console.log("   ✓ Transaction started - signing invitation sent!");

    // Print summary
    console.log();
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    ✅ SUCCESS                                ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log();
    console.log("Transaction Details:");
    console.log(`  • Transaction ID: ${transactionId}`);
    console.log(`  • Contract Number: ${SAMPLE_CONTRACT.contractNumber}`);
    console.log(`  • Signer: ${SAMPLE_SIGNER.name} <${SAMPLE_SIGNER.email}>`);
    console.log(`  • Status: ${TransactionStatusLabels[transaction.Status as keyof typeof TransactionStatusLabels]}`);
    console.log();
    console.log("Signing URL (for testing):");
    console.log(`  ${signUrl}`);
    console.log();

    if (CONFIG.POSTBACK_URL) {
      console.log("Webhook configured:");
      console.log(`  ${CONFIG.POSTBACK_URL}`);
      console.log();
    } else {
      console.log("💡 Tip: Configure POSTBACK_URL to receive status updates via webhook.");
      console.log();
    }

    // Optional: Poll for status (demonstration)
    console.log("Waiting 5 seconds before checking status...");
    await sleep(5000);
    await checkTransactionStatus(signhost, transactionId);

  } catch (error) {
    console.error();
    console.error("❌ Error occurred:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if ("statusCode" in error) {
        console.error(`   HTTP Status: ${(error as { statusCode: number }).statusCode}`);
      }
      if ("responseBody" in error) {
        console.error(`   Response: ${(error as { responseBody: string }).responseBody}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function ensureOutputDir(): Promise<void> {
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printContractSummary(): void {
  console.log("Contract Summary:");
  console.log(`  • Contract Number: ${SAMPLE_CONTRACT.contractNumber}`);
  console.log(`  • Client: ${SAMPLE_CONTRACT.clientName}`);
  console.log(`  • Provider: ${SAMPLE_CONTRACT.providerName}`);
  console.log(`  • Amount: €${SAMPLE_CONTRACT.paymentAmount.toLocaleString("nl-NL")}`);
  console.log(`  • Effective Date: ${SAMPLE_CONTRACT.effectiveDate}`);
  console.log();
}

async function checkTransactionStatus(
  signhost: SignhostService,
  transactionId: string
): Promise<void> {
  console.log();
  console.log("📊 Checking transaction status...");

  try {
    const transaction = await signhost.getTransaction(transactionId);
    const statusLabel = TransactionStatusLabels[transaction.Status as keyof typeof TransactionStatusLabels];

    console.log(`   Status: ${statusLabel} (${transaction.Status})`);

    for (const signer of transaction.Signers) {
      console.log(`   Signer: ${signer.Email}`);
      if (signer.Activities && signer.Activities.length > 0) {
        console.log("   Activities:");
        for (const activity of signer.Activities) {
          console.log(`     - ${activity.Activity} at ${activity.CreatedDateTime}`);
        }
      }
      if (signer.SignedDateTime) {
        console.log(`   ✓ Signed at: ${signer.SignedDateTime}`);
      }
      if (signer.RejectDateTime) {
        console.log(`   ✗ Rejected at: ${signer.RejectDateTime}`);
        console.log(`     Reason: ${signer.RejectReason}`);
      }
    }

    // If signed, download the signed document
    if (transaction.Status === TransactionStatus.SIGNED) {
      console.log();
      console.log("📥 Downloading signed document...");
      const signedPdf = await signhost.downloadDocument(transactionId, "contract.pdf");
      const signedPath = path.join(
        CONFIG.OUTPUT_DIR,
        `${SAMPLE_CONTRACT.contractNumber}-SIGNED.pdf`
      );
      fs.writeFileSync(signedPath, signedPdf);
      console.log(`   ✓ Signed document saved to: ${signedPath}`);

      console.log("📥 Downloading receipt...");
      const receipt = await signhost.downloadReceipt(transactionId);
      const receiptPath = path.join(
        CONFIG.OUTPUT_DIR,
        `${SAMPLE_CONTRACT.contractNumber}-RECEIPT.pdf`
      );
      fs.writeFileSync(receiptPath, receipt);
      console.log(`   ✓ Receipt saved to: ${receiptPath}`);
    }
  } catch (error) {
    console.error("   Failed to check status:", error);
  }
}

// ============================================================================
// WEBHOOK HANDLER EXAMPLE (for reference)
// ============================================================================

/**
 * Example webhook handler for Express.js
 *
 * Add this to your server to receive signing status updates:
 *
 * ```typescript
 * import express from 'express';
 * import { createSignhostService, TransactionStatus } from './signhostService';
 *
 * const app = express();
 * app.use(express.json());
 *
 * const signhost = createSignhostService({
 *   apiKey: CONFIG.SIGNHOST_API_KEY,
 *   appKey: CONFIG.SIGNHOST_APP_KEY,
 *   sharedSecret: CONFIG.SIGNHOST_SHARED_SECRET,
 * });
 *
 * app.post('/api/signhost-webhook', async (req, res) => {
 *   // Always return 200 immediately to prevent queue buildup
 *   res.status(200).send('OK');
 *
 *   // Validate and parse postback
 *   const postback = signhost.parsePostback(req.body);
 *   if (!postback) {
 *     console.warn('Invalid postback received');
 *     return;
 *   }
 *
 *   console.log(`Transaction ${postback.Id} status: ${postback.Status}`);
 *
 *   // Handle different statuses
 *   switch (postback.Status) {
 *     case TransactionStatus.SIGNED:
 *       // Download signed document and process
 *       const signedPdf = await signhost.downloadDocument(postback.Id, 'contract.pdf');
 *       // Store in database, send confirmation email, etc.
 *       break;
 *
 *     case TransactionStatus.REJECTED:
 *       // Handle rejection
 *       const rejectReason = postback.Signers[0]?.RejectReason;
 *       console.log(`Contract rejected: ${rejectReason}`);
 *       break;
 *
 *     case TransactionStatus.EXPIRED:
 *       // Handle expiration
 *       console.log('Contract expired without signature');
 *       break;
 *   }
 * });
 *
 * app.listen(3000);
 * ```
 */

// ============================================================================
// RUN DEMO
// ============================================================================

main().catch(console.error);
