import { DimensionData, TextContent } from './ocr.types';
import { nanoid } from './nanoid.function';

/**
 * * `level`: hierarchical layout (a word is in a line, which is in a paragraph, which is in a block, which is in a page), a value from 1 to 5
 *   - `1`: page
 *   - `2`: block
 *   - `3`: paragraph
 *   - `4`: line
 *   - `5`: word
 * * `page_num`: when provided with a list of images, indicates the number of the file, when provided with a multi-pages document, indicates the page number, starting from 1
 * * `block_num`: block number within the page, starting from 0
 * * `par_num`: paragraph number within the block, starting from 0
 * * `line_num`: line number within the paragraph, starting from 0
 * * `word_num`: word number within the line, starting from 0
 * * `left`: x coordinate in pixels of the text bounding box top left corner, starting from the left of the image
 * * `top`: y coordinate in pixels of the text bounding box top left corner, starting from the top of the image
 * * `width`: width of the text bounding box in pixels
 * * `height`: height of the text bounding box in pixels
 * * `conf`: confidence value, from 0 (no confidence) to 100 (maximum confidence), -1 for all level except 5
 * * `text`: detected text, empty for all levels except 5
 *
 * https://blog.tomrochette.com/tesseract-tsv-format
 */
export interface TesseractTsvLineData {
  level: number;
  page_num: number;
  block_num: number;
  par_num: number;
  line_num: number;
  word_num: number;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
}

/**
 * Parses Tesseract TSV output into structured OCR data
 * @param tsvContent - Array of TSV lines from Tesseract output
 * @returns Promise resolving to array of word-level OCR results with normalized coordinates
 * @throws {Error} When TSV parsing fails
 */
export async function parseTsvOutput(
  tsvContent: string[]
): Promise<DimensionData<TextContent>[]> {
  try {
    // SKIP HEADER LINE
    const dataLines = tsvContent.slice(1);

    const words: DimensionData<TextContent>[] = [];

    // CONSIDER `dataLines.shift()` TO GET AND PROCESS PAGE LINE
    const l = dataLines.find( x => x[0] === '1' ).split('\t');
    const pageSize = l && l.length === 12 ? { width: parseInt(l[8]), height: parseInt(l[9]) } : { width: 0, height: 0 };

    for (const line of dataLines) {
      const columns = line.split('\t');

      // HAS TO HAVE 12 COLUMNS
      if (columns.length < 12) continue;

      // ALIGN WITH MODEL / NORMALIZE DATA
      const lineData: TesseractTsvLineData = {
        level: parseInt(columns[0]),
        page_num: parseInt(columns[1]),
        block_num: parseInt(columns[2]),
        par_num: parseInt(columns[3]),
        line_num: parseInt(columns[4]),
        word_num: parseInt(columns[5]),
        left: parseInt(columns[6]) / pageSize.width,
        top: parseInt(columns[7]) / pageSize.height,
        width: parseInt(columns[8]) / pageSize.width,
        height: parseInt(columns[9]) / pageSize.height,
        conf: parseInt(columns[10]) / 100,
        text: columns[11],
      };

      // ONLY PROCESS WORD-LEVEL DATA (LEVEL 5)
      if (lineData.level === 5 && lineData.text.trim()) {
        const wordId = nanoid();

        words.push({
          left: lineData.left,
          top: lineData.top,
          width: lineData.width,
          height: lineData.height,
          data: {
            id: wordId,
            text: lineData.text.trim(),
            confidence: lineData.conf,
          },
        });
      }
    }

    return words;
  } catch (error) {
    this.logger.error('Failed to parse TSV output', error);
    throw new Error(`Failed to parse OCR results: ${error.message}`);
  }
}
