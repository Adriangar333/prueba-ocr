import { ProcessedImage, ExtractionResult, LuminariaData } from '../types';

/**
 * Extracts the watts from a given label string.
 * It looks for patterns like _70_W, _250W, or numbers at the end of the string.
 * @param label The label string from the prediction (e.g., "A_LUMINARIA_SODIO_70_W").
 * @returns The extracted watts as a number, or null if not found.
 */
export const extractWattsFromLabel = (label: string): number | null => {
  if (!label) return null;

  // Regex to find numbers followed by _W, W, or at the end of the string.
  // Example matches: 70_W, 150W, _70, -70
  const regex = /(?:_|-)(\d+)(?:_?W)?$/i;
  const match = label.match(regex);

  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // Fallback for cases like BRAZO_AZUL_70
  const fallbackRegex = /(\d+)$/;
  const fallbackMatch = label.match(fallbackRegex);
  if (fallbackMatch && fallbackMatch[0]) {
    return parseInt(fallbackMatch[0], 10);
  }

  return null;
};

/**
 * Extracts the luminaire type from a given label string.
 * @param label The label string from the prediction.
 * @returns The extracted luminaire type (e.g., "LUMINARIA_SODIO"), or null.
 */
export const extractTipoFromLabel = (label: string): string | null => {
    if (!label) return null;
    if (label.includes('LUMINARIA')) {
        // Extracts "LUMINARIA_SODIO", "LUMINARIA_LED", etc.
        const match = label.match(/(LUMINARIA_[A-Z_]+)/i);
        if (match && match[1]) {
            // Cleans up the extracted type
            return match[1].replace(/_(\d+)_?W?$/, '').replace(/_$/, '');
        }
    }
    return null;
}

/**
 * Analyzes a group of processed images to consolidate into a single LuminariaData object.
 * @param imageGroup An array of ProcessedImage objects.
 * @returns A LuminariaData object with the consolidated data.
 */
export const analyzeLuminariaGroup = (imageGroup: ProcessedImage[]): LuminariaData => {
  const allPredictions = imageGroup.flatMap(img => img.extractedResult?.predictions || []);

  // Find the best prediction (highest confidence) that is likely a luminaire
  let bestPrediction: { class: string; confidence: number } | null = null;
  for (const pred of allPredictions) {
    if (pred.class.includes('LUMINARIA') || pred.class.includes('BRAZO')) {
      if (!bestPrediction || pred.confidence > bestPrediction.confidence) {
        bestPrediction = pred;
      }
    }
  }

  // --- Data Extraction ---
  const tipoIluminaria = bestPrediction ? extractTipoFromLabel(bestPrediction.class) : null;
  const watts = bestPrediction ? extractWattsFromLabel(bestPrediction.class) : null;

  // --- Coincidence Logic ---
  const extractedCodes = imageGroup
    .map(img => img.extractedResult?.extractedCode)
    .filter(code => code && code.trim() !== '' && code.trim().toLowerCase() !== 'no encontrado');
  
  let coincidencia: LuminariaData['coincidencia'] = 'pendiente';
  if (imageGroup.length > 1 && extractedCodes.length >= 2) {
    const allSame = extractedCodes.every(code => code === extractedCodes[0]);
    if (allSame) {
      coincidencia = 'si';
    } else {
      coincidencia = 'no';
    }
  } else if (imageGroup.length === 1) {
    coincidencia = 'n/a';
  }

  const newLuminariaData: LuminariaData = {
    id: `lum-${new Date().getTime()}`,
    processedImages: imageGroup,
    coincidencia: coincidencia,
    tipoIluminaria: tipoIluminaria,
    watts: watts,
    aprobado: false,
  };

  return newLuminariaData;
};
