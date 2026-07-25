import { jsPDF } from 'jspdf';

export const TRACKBOOK_BRANDING = {
  line1: "Powered by",
  urlDisplay: "trackbook.xyz",
  url: "https://trackbook.xyz",
  legacyText: "Powered by trackbook.xyz"
};

/**
 * Adds the professional TrackBook branding footer to a jsPDF document page.
 * @param doc The jsPDF instance
 * @param pageNum Current page number
 * @param totalPages Total pages in the document
 * @param title Optional document title or book name to display in the footer
 */
export function addPdfBrandingFooter(doc: jsPDF, pageNum: number, totalPages: number, title?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Save current state (font, colors) to restore after adding footer
  const originalFontSize = doc.getFontSize();
  const originalTextColor = doc.getTextColor();

  // 1. Draw thin, light gray divider line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.1);
  doc.line(15, pageHeight - 16, pageWidth - 15, pageHeight - 16);

  // 2. Set font styling for branding line
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);

  const prefix = "Powered by ";
  const urlDisplay = "trackbook.xyz";
  const fullUrl = "https://trackbook.xyz";

  doc.setTextColor(140, 140, 140);
  const prefixWidth = doc.getTextWidth(prefix);

  doc.setTextColor(79, 70, 229); // Indigo color for clickable link
  const urlWidth = doc.getTextWidth(urlDisplay);

  const totalBrandWidth = prefixWidth + urlWidth;
  const brandX = (pageWidth - totalBrandWidth) / 2;

  // Render "Powered by "
  doc.setTextColor(140, 140, 140);
  doc.text(prefix, brandX, pageHeight - 11);

  // Render "trackbook.xyz" as clickable hyperlink
  doc.setTextColor(79, 70, 229);
  doc.textWithLink(urlDisplay, brandX + prefixWidth, pageHeight - 11, { url: fullUrl });

  // 3. Draw the standard Page X of Y and Document title in a matching subtle style
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  
  // Page number centered at the very bottom
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  
  // Left side: Document Name
  if (title) {
    const cleanTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
    doc.text(`Report: ${cleanTitle}`, 15, pageHeight - 5);
  }
  
  // Right side: Current date
  const dateStr = new Date().toLocaleDateString('en-IN');
  doc.text(dateStr, pageWidth - 15, pageHeight - 5, { align: 'right' });

  // Restore original font and color settings
  doc.setFontSize(originalFontSize);
  if (typeof originalTextColor === 'string') {
    doc.setTextColor(originalTextColor);
  }
}
