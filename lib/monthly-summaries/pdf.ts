import PDFDocument from "pdfkit";
import path from "node:path";
import { dollars, monthLabel, type Summary } from "./core.ts";

export async function renderSummaryPdf(summary: Summary, options: { sample?: boolean } = {}): Promise<Buffer> {
  if (summary.issues.length || !summary.orderCount) throw new Error("Only a ready summary can become a PDF.");
  const fontPath = path.join(process.cwd(), "public/fonts/helios.otf");
  const doc = new PDFDocument({ size: "LETTER", margin: 48, bufferPages: true, font: fontPath,
    info: { Title: `Helios Media Summary | ${monthLabel(summary.month)}`, Author: "Helios Real Estate Media" } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Attach rejection handling immediately, including errors during synchronous layout.
  void result.catch(() => {});
  try {
    doc.registerFont("Helios", fontPath);
    doc.registerFont("HeliosBold", path.join(process.cwd(), "public/fonts/heliosbold.ttf"));
    const header = () => {
      doc.rect(0, 0, 612, 792).fill("#f5f0e7");
      doc.rect(48, 38, 516, 76).fill("#0f0f10");
      doc.image(path.join(process.cwd(), "public/brand/helios-logo.png"), 216, 52, { width: 180 });
      doc.rect(48, 114, 516, 2).fill("#d96b2b");
      doc.font("Helios").fontSize(10).fillColor("#756e65");
      doc.text(`${monthLabel(summary.month)}${options.sample ? "  |  DESIGN SAMPLE - Illustrative figures" : ""}`, 48, 132, { width: 516 });
      doc.y = 162;
    };
    header();
    doc.on("pageAdded", header);
    const room = (height: number) => { if (doc.y + height > 694) doc.addPage(); };
    const text = (value: string, size = 11, color = "#5e5850", font = "Helios") => {
      doc.font(font).fontSize(size).fillColor(color);
      const drawLine = (line: string) => {
        room(size + 6);
        doc.font(font).fontSize(size).fillColor(color);
        const y = doc.y;
        doc.text(line, 48, y, { width: 516, lineBreak: false });
        doc.y = y + size + 6;
      };
      for (const paragraph of value.split(/\r?\n/)) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const candidate = line ? `${line} ${word}` : word;
          if (doc.widthOfString(candidate) <= 516) { line = candidate; continue; }
          if (line) drawLine(line);
          line = "";
          for (const char of word) {
            if (doc.widthOfString(line + char) > 516) { drawLine(line); line = ""; }
            line += char;
          }
        }
        drawLine(line);
      }
    };
    text("Your Monthly Media Summary", 26, "#201e1b");
    doc.y += 10;
    text(`Prepared for ${summary.firstName}`);
    doc.y += 16;
    text(`${summary.properties.length} Properties    |    Total Purchases ${dollars(summary.totalCents)}`, 16, "#201e1b", "HeliosBold");
    text("Includes applicable tax and order discounts.", 9);
    doc.y += 20;
    for (const property of summary.properties) {
      room(90);
      text(property.address, 13, "#201e1b", "HeliosBold");
      text(property.services.join(" · "));
      doc.y += 4;
      text(dollars(property.totalCents), 16, "#201e1b");
      doc.y += 8;
      doc.moveTo(48, doc.y).lineTo(564, doc.y).strokeColor("#d8cfc0").stroke();
      doc.y += 18;
    }
    room(96);
    text("Thank you for trusting Helios with your listings.");
    text("Jake and the Helios Team", 11, "#201e1b", "HeliosBold");
    doc.y += 8;
    text("Light. Clarity. Vision.", 11, "#d96b2b");
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index++) {
      doc.switchToPage(index);
      doc.page.margins.bottom = 0;
      doc.font("Helios").fontSize(8).fillColor("#756e65");
      doc.text("Purchase summary, not an invoice or confirmation of payment or completion.", 48, 724, { width: 516, lineBreak: false });
      doc.text(`Helios Real Estate Media  |  ${monthLabel(summary.month)}  |  ${index + 1} / ${range.count}`, 48, 742, { width: 516, lineBreak: false });
    }
    doc.end();
    return await result;
  } catch (error) { doc.destroy(); throw error; }
}

export async function summaryPdfAttachment(summary: Summary) {
  const content = await renderSummaryPdf(summary);
  if (content.length > 5 * 1024 * 1024) throw new Error("Summary PDF exceeds the attachment limit. Review before sending.");
  return { filename: `Helios-Media-Summary-${summary.month}.pdf`, content: content.toString("base64"), contentType: "application/pdf" };
}
