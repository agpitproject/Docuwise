const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract raw text from uploaded file based on extension
 * @param {string} filePath - absolute path to file
 * @param {string} ext - 'txt' | 'pdf' | 'docx'
 * @returns {Promise<string>}
 */
const extractText = async (filePath, ext) => {
  switch (ext) {
    case 'txt':
      return fs.readFileSync(filePath, 'utf-8');

    case 'pdf': {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    case 'docx': {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
};

module.exports = { extractText };
