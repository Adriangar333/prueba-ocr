
// TODO: Reemplaza este valor con tu clave de API de Roboflow
import { Prediction, ExtractionResult } from '../types';

// TODO: Reemplaza este valor con tu clave de API de Roboflow
const ROBOFLOW_API_KEY = 'U0RfNMDb629TMgD1GZ7i';
const ROBOFLOW_ENDPOINT = 'https://serverless.roboflow.com/adrian-twrhb/workflows/custom-workflow-3';

export const luminairePrefixMap: { [key: string]: string } = {
  'A _LUMINARIA_SODIO_70_W': 'A',
  'B_LUMINARIA_': 'B',
  'C_LUMINARIA_': 'C',
  'D_LUMINARIA_': 'D',
  // Añade aquí cualquier otra clase de luminaria que deba ser un prefijo
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Quita el prefijo 'data:image/jpeg;base64,' para obtener solo los datos en base64
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const extractCodeFromImage = async (file: File): Promise<ExtractionResult> => {
  const imageBase64 = await fileToBase64(file);

  try {
    const response = await fetch(ROBOFLOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: ROBOFLOW_API_KEY,
        inputs: {
            image: {type: "base64", value: imageBase64}
        }
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Error response from Roboflow:', errorBody);
      throw new Error(`Error from Roboflow API: ${response.statusText}`);
    }

    const data = await response.json();

    const allPredictions: Prediction[] = data.outputs?.[0]?.predictions?.predictions || [];

    let luminairePrefix = '';
    const otherPredictions: Prediction[] = [];

    allPredictions.forEach(p => {
      if (luminairePrefixMap[p.class]) {
        // Si ya encontramos un prefijo, tomamos el de mayor confianza
        if (!luminairePrefix || p.confidence > allPredictions.find(op => luminairePrefixMap[op.class] === luminairePrefix)?.confidence!) {
          luminairePrefix = luminairePrefixMap[p.class];
        }
      } else {
        otherPredictions.push(p);
      }
    });

    // Filtrar las predicciones restantes que son dígitos o letras y ordenarlas por su posición X
    const digitAndLetterPredictions = otherPredictions
      .filter(p => /^[0-9A-Z]$/i.test(p.class))
      .sort((a, b) => a.x - b.x);

    const extractedCode = luminairePrefix + digitAndLetterPredictions.map(p => p.class).join('');

    return {
      extractedCode: extractedCode || 'No encontrado',
      predictions: allPredictions,
    };
  } catch (error) {
    console.error('Error calling Roboflow API:', error);
    throw new Error('Fallo al procesar la imagen con la API de Roboflow.');
  }
};
