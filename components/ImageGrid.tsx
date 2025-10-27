
import React from 'react';
import { ProcessedImage } from '../types';
import ImageCard from './ImageCard';

interface ImageGridProps {
  title?: string;
  images: ProcessedImage[];
  onCodeEdited: (imageId: string, newCode: string) => void;
  onPredictionClassEdited: (imageId: string, predictionId: string, newClass: string) => void;
}

const ImageGrid: React.FC<ImageGridProps> = ({ title, images, onCodeEdited, onPredictionClassEdited }) => {
  if (images.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {title && <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((image) => (
          <ImageCard 
            key={image.id} 
            image={image} 
            predictions={image.extractedResult?.predictions || []} 
            onCodeEdited={onCodeEdited} 
            onPredictionClassEdited={onPredictionClassEdited} 
          />
        ))}
      </div>
    </div>
  );
};

export default ImageGrid;
