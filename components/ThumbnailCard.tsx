
import React, { useRef, useEffect, useState } from 'react';
import { Prediction } from '../types';

interface ThumbnailCardProps {
  src: string;
  predictions: Prediction[];
}

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ src, predictions }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match the displayed image dimensions
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const displayedWidth = img.offsetWidth;
    const displayedHeight = img.offsetHeight;

    canvas.width = displayedWidth;
    canvas.height = displayedHeight;

    const scaleX = displayedWidth / imgWidth;
    const scaleY = displayedHeight / imgHeight;

    // Clear canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    });
  }, [imageLoaded, predictions, src]);

  return (
    <div className="relative w-16 h-16 object-cover rounded-md border border-gray-600 mr-2">
      <img
        ref={imgRef}
        src={src}
        alt="Thumbnail"
        className="w-full h-full object-cover rounded-md"
        onLoad={() => setImageLoaded(true)}
        crossOrigin="anonymous" // Important for canvas with cross-origin images
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
    </div>
  );
};

export default ThumbnailCard;
