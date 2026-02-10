
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Annotation, EditorTool } from '../types';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 0, g: 0, b: 0 };
};

export const savePdfWithAnnotations = async (
  originalData: Uint8Array,
  annotations: Annotation[]
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(originalData);
  const pages = pdfDoc.getPages();

  for (const annotation of annotations) {
    const page = pages[annotation.pageIndex];
    if (!page) continue;

    const { height } = page.getSize();
    const colorRgb = hexToRgb(annotation.color);
    const color = rgb(colorRgb.r, colorRgb.g, colorRgb.b);

    if (annotation.type === EditorTool.TEXT && annotation.content) {
      const fontName = annotation.fontFamily === 'Courier' ? StandardFonts.Courier : StandardFonts.Helvetica;
      const font = await pdfDoc.embedFont(fontName);
      
      // Calculate basic alignment offset (naive)
      let xOffset = 0;
      if (annotation.alignment === 'center') xOffset = -50;
      else if (annotation.alignment === 'right') xOffset = -100;

      page.drawText(annotation.content, {
        x: annotation.x + xOffset,
        y: height - annotation.y - (annotation.fontSize || 12),
        size: annotation.fontSize || 14,
        font,
        color,
      });
    } else if (annotation.type === EditorTool.HIGHLIGHT) {
      page.drawRectangle({
        x: annotation.x,
        y: height - annotation.y - 15,
        width: annotation.width || 100,
        height: annotation.height || 15,
        color,
        opacity: 0.4,
      });
    } else if (annotation.type === EditorTool.SQUARE) {
      page.drawRectangle({
        x: annotation.x,
        y: height - annotation.y - (annotation.height || 0),
        width: annotation.width || 50,
        height: annotation.height || 50,
        borderColor: color,
        borderWidth: annotation.thickness,
      });
    } else if (annotation.type === EditorTool.CIRCLE) {
      page.drawEllipse({
        x: annotation.x + (annotation.width || 0) / 2,
        y: height - annotation.y - (annotation.height || 0) / 2,
        xScale: (annotation.width || 0) / 2,
        yScale: (annotation.height || 0) / 2,
        borderColor: color,
        borderWidth: annotation.thickness,
      });
    } else if (annotation.type === EditorTool.LINE) {
        if (annotation.points && annotation.points.length >= 2) {
            page.drawLine({
                start: { x: annotation.points[0].x, y: height - annotation.points[0].y },
                end: { x: annotation.points[1].x, y: height - annotation.points[1].y },
                thickness: annotation.thickness,
                color,
            });
        }
    } else if (annotation.type === EditorTool.DRAW && annotation.points && annotation.points.length > 1) {
      for (let i = 0; i < annotation.points.length - 1; i++) {
        const start = annotation.points[i];
        const end = annotation.points[i + 1];
        page.drawLine({
          start: { x: start.x, y: height - start.y },
          end: { x: end.x, y: height - end.y },
          thickness: annotation.thickness,
          color,
          opacity: 1,
        });
      }
    }
  }

  return await pdfDoc.save();
};
