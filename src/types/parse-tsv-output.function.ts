import { DimensionData, TextContent } from './ocr.types';
import { nanoid } from './nanoid.function';

// CHARACTERS WITH DESCENDERS THAT EXTEND BELOW THE BASELINE
const DESCENDER_CHARS = new Set([
  // lowercase letters
  'g',
  'j',
  'p',
  'q',
  'y',

  // letters with cedilla / comma / ogonek
  'ç',
  'ģ',
  'ķ',
  'ļ',
  'ą',
  'ę',
  'į',
  'ų',
  'ș',
  'ț',
  'Ș',
  'Ț',

  // extended Latin / phonetic
  'ŋ',
  'ɟ',
  'ʝ',
  'ɡ',
  'ɣ',
  'ʄ',
  'ȷ',

  // punctuation
  ',',
  ';',
  '‚',
  '„',
  '¿',

  // brackets / delimiters (font-dependent but common)
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',

  // math / technical
  '∫',
  '∮',
  '∂',
  'ƒ',
  '₍',
  '₎',

  // currency
  '₤',
  '₺',
  '₥',
  '₰',
]);

// FACTOR FOR DESCENDER SPACE (APPROXIMATELY 23% OF TEXT HEIGHT)
const DESCENDER_FACTOR = 0.23;

/**
 * Calculates baseline position for a word based on character composition
 * @param text - The text content to analyze
 * @param top - Normalized top position of the bounding box
 * @param height - Normalized height of the bounding box
 * @returns Normalized baseline position
 */
function calculateBaseline(text: string, top: number, height: number): number {
  // CHECK IF TEXT CONTAINS ANY DESCENDER CHARACTERS
  const hasDescenders = text
    .toLowerCase()
    .split('')
    .some((char) => DESCENDER_CHARS.has(char));

  if (hasDescenders) {
    // BASELINE ABOVE BOTTOM TO ACCOUNT FOR DESCENDERS
    return top + height * (1 - DESCENDER_FACTOR);
  } else {
    // BASELINE AT BOTTOM BORDER FOR TEXT WITHOUT DESCENDERS
    return top + height;
  }
}

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
  tsvContent: string[],
): Promise<DimensionData<TextContent>[]> {
  try {
    // SKIP HEADER LINE
    const dataLines = tsvContent.slice(1);

    const words: DimensionData<TextContent>[] = [];

    // CONSIDER `dataLines.shift()` TO GET AND PROCESS PAGE LINE
    const l = dataLines.find((x) => x[0] === '1').split('\t');
    const pageSize =
      l && l.length === 12
        ? { width: parseInt(l[8]), height: parseInt(l[9]) }
        : { width: 0, height: 0 };

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
          baseline: calculateBaseline(
            lineData.text.trim(),
            lineData.top,
            lineData.height,
          ),
          data: {
            id: wordId,
            text: lineData.text.trim(),
            confidence: lineData.conf,
          },
        });
      }
    }

    // SORT WORDS IN READING ORDER: TOP TO BOTTOM BY BASELINE, LEFT TO RIGHT WITHIN LINES
    return sortWordsInReadingOrder(words);
  } catch (error) {
    this.logger.error('Failed to parse TSV output', error);
    throw new Error(`Failed to parse OCR results: ${error.message}`);
  }
}

/**
 * Sorts words in natural reading order by grouping words with similar baselines and sorting by position
 * @param words - Array of word elements with baseline and position data
 * @returns Array of words sorted in reading order (top to bottom, left to right)
 */
function sortWordsInReadingOrder(words: DimensionData<TextContent>[]): DimensionData<TextContent>[] {
  const BASELINE_TOLERANCE = 0.0025;
  
  if (words.length === 0) return words;
  
  // GROUP WORDS BY BASELINE WITHIN TOLERANCE
  const lineGroups: DimensionData<TextContent>[][] = [];
  
  for (const word of words) {
    const wordBaseline = word.baseline!;
    
    // FIND EXISTING GROUP WITH SIMILAR BASELINE
    let foundGroup = false;
    for (const group of lineGroups) {
      const groupBaseline = group[0].baseline!;
      if (Math.abs(wordBaseline - groupBaseline) <= BASELINE_TOLERANCE) {
        group.push(word);
        foundGroup = true;
        break;
      }
    }
    
    // CREATE NEW GROUP IF NO MATCH FOUND
    if (!foundGroup) {
      lineGroups.push([word]);
    }
  }
  
  // SORT GROUPS BY AVERAGE BASELINE (TOP TO BOTTOM)
  lineGroups.sort((a, b) => {
    const avgBaselineA = a.reduce((sum, word) => sum + word.baseline!, 0) / a.length;
    const avgBaselineB = b.reduce((sum, word) => sum + word.baseline!, 0) / b.length;
    return avgBaselineA - avgBaselineB;
  });
  
  // SORT WORDS WITHIN EACH GROUP BY LEFT POSITION (LEFT TO RIGHT)
  for (const group of lineGroups) {
    group.sort((a, b) => a.left - b.left);
  }
  
  // FLATTEN GROUPS BACK TO SINGLE ARRAY
  return lineGroups.flat();
}
