
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { luminairePrefixMap } from '../services/geminiService';
import { SpinnerIcon, DownloadIcon, CheckCircleIcon, XCircleIcon, EyeIcon, EyeOffIcon, CameraIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

interface ImageCardProps {
  image: ProcessedImage;
  predictions: Prediction[];
  onCodeEdited: (imageId: string, newCode: string) => void;
  onPredictionClassEdited: (imageId: string, predictionId: string, newClass: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, predictions, onCodeEdited, onPredictionClassEdited }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showDetections, setShowDetections] = useState(true);
  const [editableCode, setEditableCode] = useState(image.extractedResult?.extractedCode || '');
  const [showPredictionDetails, setShowPredictionDetails] = useState(false);

  useEffect(() => {
    setEditableCode(image.extractedResult?.extractedCode || '');
  }, [image.extractedResult?.extractedCode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showDetections) return; // Don't draw if detections are hidden

    // Set canvas dimensions to match the displayed image dimensions
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const displayedWidth = img.offsetWidth;
    const displayedHeight = img.offsetHeight;

    canvas.width = displayedWidth;
    canvas.height = displayedHeight;

    const scaleX = displayedWidth / imgWidth;
    const scaleY = displayedHeight / imgHeight;

    predictions.forEach(p => {
      // Draw bounding box
      ctx.beginPath();
      ctx.rect(
        p.x * scaleX - (p.width / 2) * scaleX,
        p.y * scaleY - (p.height / 2) * scaleY,
        p.width * scaleX,
        p.height * scaleY
      );
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00FF00'; // Green color for bounding box
      ctx.stroke();

      // Draw label background
      ctx.fillStyle = '#00FF00'; // Green background for text
      const text = `${p.class} (${(p.confidence * 100).toFixed(1)}%)`;
      const fontSize = 12;
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(text).width;
      const textHeight = fontSize + 4; // Add some padding

      ctx.fillRect(
        p.x * scaleX - (p.width / 2) * scaleX,
        p.y * scaleY - (p.height / 2) * scaleY - textHeight,
        textWidth + 6,
        textHeight
      );

      // Draw label text
      ctx.fillStyle = '#000000'; // Black text
      ctx.fillText(
        text,
        p.x * scaleX - (p.width / 2) * scaleX + 3,
        p.y * scaleY - (p.height / 2) * scaleY - 4
      );
    });
  }, [imageLoaded, predictions, image.previewUrl, showDetections]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image.previewUrl; // This URL points to the original blob data
    
    const extension = image.file.name.split('.').pop() || 'jpg';
    const safeCode = image.extractedResult?.extractedCode?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'sin_codigo';
    const uniquePart = image.id.substring(0, 8);

    const finalName = (image.status !== 'success' || safeCode === 'no_encontrado' || !image.extractedResult?.extractedCode)
      ? `no-encontrado_${uniquePart}` 
      : safeCode;

    link.download = `${finalName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableCode(e.target.value);
  }, []);

  const handleCodeBlur = useCallback(() => {
    if (editableCode !== image.extractedResult?.extractedCode) {
      onCodeEdited(image.id, editableCode);
    }
  }, [editableCode, image.id, image.extractedResult?.extractedCode, onCodeEdited]);

  const handlePredictionClassChange = useCallback((predictionId: string, newClass: string) => {
    onPredictionClassEdited(image.id, predictionId, newClass);
  }, [image.id, onPredictionClassEdited]);

  const hasFotoCelda = predictions.some(p => p.class === 'Foto_celda');

  const otherPredictions = predictions.filter(p => !/^[0-9A-Z]$/i.test(p.class) && !Object.keys(luminairePrefixMap).includes(p.class));

  const renderStatus = () => {
    switch (image.status) {
      case 'processing':
        return (
          <div className="flex items-center justify-center text-blue-400">
            <SpinnerIcon className="w-5 h-5 animate-spin mr-2" />
            <span>Procesando...</span>
          </div>
        );
      case 'success':
        const isFound = editableCode && editableCode.toLowerCase() !== 'no encontrado' && !editableCode.toLowerCase().includes('error');
        return (
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-between w-full mb-2">
              <div className={`flex items-center ${isFound ? 'text-green-400' : 'text-yellow-400'}`}>
                <input
                  type="text"
                  value={editableCode}
                  onChange={handleCodeChange}
                  onBlur={handleCodeBlur}
                  className="font-mono font-bold text-lg bg-transparent border-b border-gray-600 focus:border-blue-500 outline-none w-32"
                  aria-label="Código extraído editable"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDetections(!showDetections)}
                  className="p-2 rounded-full bg-gray-600 hover:bg-blue-500 text-white transition-colors duration-200"
                  aria-label={showDetections ? "Ocultar detecciones" : "Mostrar detecciones"}
                  title={showDetections ? "Ocultar detecciones" : "Mostrar detecciones"}
                >
                  {showDetections ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-full bg-gray-600 hover:bg-blue-500 text-white transition-colors duration-200"
                  aria-label="Descargar imagen"
                  title="Descargar imagen"
                >
                  <DownloadIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="w-full">
              <button
                onClick={() => setShowPredictionDetails(!showPredictionDetails)}
                className="w-full text-left text-sm text-gray-400 hover:text-blue-400 flex items-center justify-between"
              >
                Detalles de Predicción
                {showPredictionDetails ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
              </button>
              {showPredictionDetails && (
                <div className="mt-2 text-xs text-gray-300 max-h-24 overflow-y-auto custom-scrollbar">
                  {otherPredictions.length > 0 ? (
                    otherPredictions.map((p) => (
                      <div key={p.detection_id} className="mb-1 flex items-center">
                        <input
                          type="text"
                          value={p.class}
                          onChange={(e) => handlePredictionClassChange(p.detection_id, e.target.value)}
                          className="font-semibold bg-transparent border-b border-gray-600 focus:border-blue-500 outline-none text-green-400 w-2/3"
                        />
                        <span className="ml-2">{(p.confidence * 100).toFixed(1)}%</span>
                      </div>
                    ))
                  ) : (
                    <p>No hay otras predicciones detalladas.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-between w-full mb-2 text-red-400">
              <div className="flex items-center">
                  <XCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm truncate" title={image.extractedResult?.extractedCode || 'Error'}>{image.extractedResult?.extractedCode || 'Error al procesar'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDetections(!showDetections)}
                  className="p-2 rounded-full bg-gray-600 hover:bg-blue-500 text-white transition-colors duration-200"
                  aria-label={showDetections ? "Ocultar detecciones" : "Mostrar detecciones"}
                  title={showDetections ? "Ocultar detecciones" : "Mostrar detecciones"}
                >
                  {showDetections ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-full bg-gray-600 hover:bg-blue-500 text-white transition-colors duration-200 ml-2"
                  aria-label="Descargar imagen original"
                  title="Descargar imagen original"
                >
                  <DownloadIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="w-full">
              <button
                onClick={() => setShowPredictionDetails(!showPredictionDetails)}
                className="w-full text-left text-sm text-gray-400 hover:text-blue-400 flex items-center justify-between"
              >
                Detalles de Predicción
                {showPredictionDetails ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
              </button>
              {showPredictionDetails && (
                <div className="mt-2 text-xs text-gray-300 max-h-24 overflow-y-auto custom-scrollbar">
                  {otherPredictions.length > 0 ? (
                    otherPredictions.map((p) => (
                      <div key={p.detection_id} className="mb-1 flex items-center">
                        <input
                          type="text"
                          value={p.class}
                          onChange={(e) => handlePredictionClassChange(p.detection_id, e.target.value)}
                          className="font-semibold bg-transparent border-b border-gray-600 focus:border-blue-500 outline-none text-green-400 w-2/3"
                        />
                        <span className="ml-2">{(p.confidence * 100).toFixed(1)}%</span>
                      </div>
                    ))
                  ) : (
                    <p>No hay otras predicciones detalladas.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 'pending':
      default:
        return <div className="text-gray-400">Pendiente</div>;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex flex-col">
      <div className="relative aspect-w-1 aspect-h-1 w-full bg-gray-900">
        <img
          ref={imgRef}
          src={image.previewUrl}
          alt={image.file.name}
          className="w-full h-full object-contain"
          onLoad={() => setImageLoaded(true)}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
      </div>
      <div className="p-4 bg-gray-800/80 backdrop-blur-sm min-h-[76px] flex items-center justify-center">
        {renderStatus()}
      </div>
    </div>
  );
};

export default ImageCard;
