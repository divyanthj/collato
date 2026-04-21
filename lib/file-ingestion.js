import mammoth from "mammoth";
import { openai } from "@/lib/openai";
import { compactText } from "@/lib/knowledge-summary";

function getExtension(fileName) {
  const normalized = String(fileName ?? "").toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return normalized.slice(dotIndex);
}

function isExtractableTextFile(fileName, fileType) {
  const extension = getExtension(fileName);
  const normalizedType = String(fileType ?? "").toLowerCase();

  return (
    normalizedType.startsWith("text/") ||
    ["application/json", "application/xml"].includes(normalizedType) ||
    [".txt", ".md", ".csv", ".json", ".xml"].includes(extension)
  );
}

function isDocxFile(fileName, fileType) {
  const extension = getExtension(fileName);
  const normalizedType = String(fileType ?? "").toLowerCase();

  return (
    extension === ".docx" ||
    normalizedType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isPdfFile(fileName, fileType) {
  const extension = getExtension(fileName);
  const normalizedType = String(fileType ?? "").toLowerCase();

  return extension === ".pdf" || normalizedType === "application/pdf";
}

function isImageFile(fileType) {
  return String(fileType ?? "").toLowerCase().startsWith("image/");
}

function toDataUrl(buffer, contentType) {
  return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(arrayBuffer),
  });

  return compactText(result.value).slice(0, 30000);
}

async function extractPdfText(file) {
  const { PDFParse } = await import("pdf-parse");
  const arrayBuffer = await file.arrayBuffer();
  const parser = new PDFParse({
    data: Buffer.from(arrayBuffer),
  });

  try {
    const result = await parser.getText();
    return compactText(result.text).slice(0, 30000);
  } finally {
    await parser.destroy();
  }
}

function normalizeExtractionFailure(error) {
  if (!(error instanceof Error)) {
    return "Automatic text extraction is unavailable in the current runtime.";
  }

  const message = error.message || "";

  if (message.includes("DOMMatrix is not defined")) {
    return "Automatic text extraction is unavailable in the current runtime (missing PDF DOM polyfills).";
  }

  if (message.includes("@napi-rs/canvas")) {
    return "Automatic text extraction is unavailable in the current runtime (missing @napi-rs/canvas dependency).";
  }

  return "Automatic text extraction failed for this file in the current runtime.";
}

async function extractImageTextWithAi(file) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const response = await openai.responses.create({
    model: "gpt-5.2",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "Extract the most useful business/project knowledge from the image. Include visible text via OCR, entities, figures, dates, locations, and a concise description. Return plain text only.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: toDataUrl(arrayBuffer, file.type || "image/png"),
          },
        ],
      },
    ],
  });

  return compactText(response.output_text).slice(0, 12000);
}

export async function extractKnowledgeFromFile(file) {
  const fileName = String(file?.name ?? "");
  const fileType = String(file?.type ?? "");

  if (!file) {
    return {
      extractedText: "",
      extractionStatus: "empty",
      extractionSummary: "No file was uploaded.",
    };
  }

  if (isExtractableTextFile(fileName, fileType)) {
    const text = compactText(await file.text());

    return {
      extractedText: text.slice(0, 30000),
      extractionStatus: text ? "extracted" : "empty",
      extractionSummary: text
        ? "Text extracted automatically from the uploaded file."
        : "The uploaded file did not contain readable text.",
    };
  }

  if (isDocxFile(fileName, fileType)) {
    try {
      const text = await extractDocxText(file);

      return {
        extractedText: text,
        extractionStatus: text ? "extracted" : "empty",
        extractionSummary: text
          ? "Text extracted automatically from the uploaded .docx file."
          : "The uploaded .docx file did not contain readable text.",
      };
    } catch (error) {
      return {
        extractedText: "",
        extractionStatus: "unsupported",
        extractionSummary: normalizeExtractionFailure(error),
      };
    }
  }

  if (isPdfFile(fileName, fileType)) {
    try {
      const text = await extractPdfText(file);

      return {
        extractedText: text,
        extractionStatus: text ? "extracted" : "empty",
        extractionSummary: text
          ? "Text extracted automatically from the uploaded PDF."
          : "The uploaded PDF did not contain readable text.",
      };
    } catch (error) {
      return {
        extractedText: "",
        extractionStatus: "unsupported",
        extractionSummary: normalizeExtractionFailure(error),
      };
    }
  }

  if (isImageFile(fileType)) {
    const text = await extractImageTextWithAi(file);

    return {
      extractedText: text,
      extractionStatus: text ? "ai_extracted" : "empty",
      extractionSummary: text
        ? "Knowledge extracted from the image with AI."
        : "The uploaded image did not yield useful knowledge.",
    };
  }

  const extension = getExtension(fileName);

  return {
    extractedText: "",
    extractionStatus: "unsupported",
    extractionSummary: extension
      ? `Automatic extraction is not available yet for ${extension} files.`
      : "Automatic extraction is not available yet for this file type.",
  };
}

export function buildKnowledgeText({ extractedText, manualNotes }) {
  const cleanedExtractedText = compactText(extractedText);
  const cleanedManualNotes = compactText(manualNotes);

  if (cleanedExtractedText && cleanedManualNotes) {
    return `${cleanedExtractedText}\n\nAdditional notes:\n${cleanedManualNotes}`;
  }

  return cleanedExtractedText || cleanedManualNotes;
}
