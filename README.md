# Signhost Contract Signing Demo

Generate contracts as PDFs and send them for electronic signature via [Signhost](https://www.signhost.com) (Evidos).

## Project Structure

```
├── contractPdfBuilder.ts   # PDF generation with PDFKit
├── signhostService.ts      # Signhost API integration
├── demo.ts                 # Executable demo script
├── .env                    # Environment variables (create from .env-example)
├── .env-example            # Template for environment variables
├── .gitignore              # Git ignore rules
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env-example .env
```

Edit `.env` with your Signhost credentials and client/signer information:

```bash
# Signhost API Credentials
# Get these from your Signhost portal: https://portal.signhost.com
SIGNHOST_API_KEY=your_api_key_here
SIGNHOST_APP_KEY=your_app_key_here
SIGNHOST_SHARED_SECRET=your_shared_secret_here

# Webhook URL for receiving signing status updates (optional)
POSTBACK_URL=

# Where to save generated PDFs locally
OUTPUT_DIR=./output

# Demo mode: if true, saves PDF locally without sending to Signhost
DEMO_MODE=false

# Client Information (the person who will sign)
CLIENT_NAME=John Doe
CLIENT_ADDRESS=123 Main Street
CLIENT_CITY=Amsterdam, Netherlands
CLIENT_EMAIL=client@example.com

# Provider Information (your company)
PROVIDER_NAME=Your Company B.V.
PROVIDER_ADDRESS=456 Business Ave
PROVIDER_CITY=Amsterdam, Netherlands

# Signer Information
SIGNER_EMAIL=signer@example.com
SIGNER_NAME=John Doe
SIGNER_MOBILE=+31600000000
```

Get your API credentials from the [Signhost Portal](https://portal.signhost.com).

### 3. Run Demo

```bash
# Run with ts-node
npm run demo

# Or directly
npx ts-node demo.ts
```

### Demo Mode

To generate a PDF without sending to Signhost (for testing the PDF generation), set in your `.env` file:

```bash
DEMO_MODE=true
```

## File Descriptions

### contractPdfBuilder.ts

Generates professional contract PDFs using PDFKit. Features:

- Clean, professional layout
- Numbered sections and items
- Automatic page breaks
- Invisible signature markers for e-signature placement
- Configurable options (page size, margins)

```typescript
import { generateContractPdf, ContractData } from "./contractPdfBuilder";

const contract: ContractData = {
  clientName: "John Doe",
  clientAddress: "123 Main St",
  // ... other fields
};

const pdfBuffer = await generateContractPdf(contract);
```

### signhostService.ts

Complete Signhost API wrapper. Features:

- Transaction creation and management
- File upload with signature field placement
- Document download (signed + receipt)
- Webhook validation
- Status tracking
- Error handling

```typescript
import { createSignhostService, TransactionStatus } from "./signhostService";

const signhost = createSignhostService({
  apiKey: "...",
  appKey: "...",
  sharedSecret: "...",
});

// Create transaction
const transaction = await signhost.createTransaction({
  signers: [{ email: "signer@example.com", name: "John Doe" }],
  reference: "CONTRACT-001",
});

// Upload and start
await signhost.uploadFileMetadata(transactionId, fileId, signerId, "Contract", {
  searchText: "{{ClientSignature}}",
});
await signhost.uploadFile(transactionId, fileId, pdfBuffer);
await signhost.startTransaction(transactionId);
```

### demo.ts

Executable script that demonstrates the complete flow:

1. Generate a contract PDF
2. Create a Signhost transaction
3. Upload the PDF with signature placement
4. Start the signing process
5. Check transaction status

## API Reference

### ContractData Interface

```typescript
interface ContractData {
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientEmail: string;
  providerName: string;
  providerAddress: string;
  providerCity: string;
  contractNumber: string;
  effectiveDate: string;
  projectDescription: string;
  paymentAmount: number;
  paymentTerms: string;
}
```

### Transaction Status Codes

| Status | Code | Description |
|--------|------|-------------|
| WAITING_FOR_DOCUMENT | 5 | Waiting for file upload |
| WAITING_FOR_SIGNER | 10 | Ready for signing |
| IN_PROGRESS | 20 | Being processed |
| SIGNED | 30 | Successfully signed |
| REJECTED | 40 | Signer rejected |
| EXPIRED | 50 | Transaction expired |
| CANCELLED | 60 | Manually cancelled |
| FAILED | 70 | Technical error |

## Webhook Integration

To receive real-time status updates, configure a webhook URL:

```typescript
const transaction = await signhost.createTransaction({
  signers: [...],
  postbackUrl: "https://your-domain.com/api/webhook",
});
```

Handle webhooks in your server:

```typescript
app.post("/api/webhook", (req, res) => {
  // Always respond 200 immediately
  res.status(200).send("OK");

  // Validate postback
  const postback = signhost.parsePostback(req.body);
  if (!postback) return;

  // Process based on status
  if (postback.Status === TransactionStatus.SIGNED) {
    // Download signed document, update database, etc.
  }
});
```

## Signature Placement

The PDF builder includes invisible markers (`{{ClientSignature}}`, `{{ProviderSignature}}`) that Signhost uses to position signature fields. Configure placement when uploading:

```typescript
await signhost.uploadFileMetadata(transactionId, fileId, signerId, "Contract", {
  searchText: "{{ClientSignature}}", // Text to search for
  width: 200,                        // Signature field width
  height: 80,                        // Signature field height
});
```

## PDF guidelines

When the PDF is not correctly generated the signing process may fail, or signed documents may stay in 'processing' phase. See this document for [PDF requirements](https://intercom.help/signhost/nl/articles/3838091-pdf-document-vereisten)

## Building for Production

```bash
# Compile TypeScript
npm run build

# Run compiled JavaScript
npm start
```

## Resources

- [Signhost API Documentation](https://evidos.github.io/)
- [Signhost Portal](https://portal.signhost.com)
- [PDF requirements](https://intercom.help/signhost/nl/articles/3838091-pdf-document-vereisten)
- [PDFKit Documentation](http://pdfkit.org/)
