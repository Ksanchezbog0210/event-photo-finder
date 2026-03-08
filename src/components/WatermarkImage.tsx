import { useState } from "react";

interface WatermarkImageProps {
  src: string;
  alt: string;
  watermarkText?: string;
  className?: string;
  onClick?: () => void;
}

const WatermarkImage = ({
  src,
  alt,
  watermarkText = "PLUSSPAZ",
  className = "",
  onClick,
}: WatermarkImageProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-lg cursor-pointer group ${className}`}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
        draggable={false}
      />
      {!loaded && (
        <div className="absolute inset-0 bg-secondary animate-pulse" />
      )}
      {/* Watermark overlay */}
      <div className="watermark-overlay">
        <span className="watermark-text">{watermarkText}</span>
      </div>
      <div className="watermark-overlay" style={{ transform: "translateY(-40%)" }}>
        <span className="watermark-text text-lg md:text-2xl">{watermarkText}</span>
      </div>
      <div className="watermark-overlay" style={{ transform: "translateY(40%)" }}>
        <span className="watermark-text text-lg md:text-2xl">{watermarkText}</span>
      </div>
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors duration-300" />
    </div>
  );
};

export default WatermarkImage;
