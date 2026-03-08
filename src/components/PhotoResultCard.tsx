import { Check, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import WatermarkImage from "./WatermarkImage";

interface PhotoResultCardProps {
  src: string;
  matchScore: number;
  index: number;
  isFree: boolean;
  isPurchased: boolean;
  onRequestPurchase: () => void;
}

const PhotoResultCard = ({
  src,
  matchScore,
  index,
  isFree,
  isPurchased,
  onRequestPurchase,
}: PhotoResultCardProps) => {
  const confidence = Math.round(matchScore * 100);

  return (
    <div
      className="glass-card overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="relative aspect-[4/3]">
        {isPurchased || isFree ? (
          <img
            src={src}
            alt={`Resultado ${index + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <WatermarkImage src={src} alt={`Resultado ${index + 1}`} />
        )}
        {/* Match badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm px-2.5 py-1 text-xs font-display">
          <div
            className={`h-2 w-2 rounded-full ${
              confidence >= 85
                ? "bg-green-500"
                : confidence >= 70
                ? "bg-primary"
                : "bg-muted-foreground"
            }`}
          />
          <span className="text-foreground">{confidence}%</span>
        </div>
        {isFree && (
          <div className="absolute top-2 left-2 rounded-full bg-primary px-2.5 py-1 text-xs font-display font-semibold text-primary-foreground">
            GRATIS
          </div>
        )}
      </div>
      <div className="p-3">
        {isFree ? (
          <Button variant="outline" size="sm" className="w-full border-primary/30 text-primary hover:bg-primary/10 font-display">
            <Download className="mr-2 h-3.5 w-3.5" />
            Descargar gratis
          </Button>
        ) : isPurchased ? (
          <Button variant="outline" size="sm" className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 font-display">
            <Check className="mr-2 h-3.5 w-3.5" />
            Descarga disponible
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onRequestPurchase}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display"
          >
            <Lock className="mr-2 h-3.5 w-3.5" />
            $2.00 — Comprar
          </Button>
        )}
      </div>
    </div>
  );
};

export default PhotoResultCard;
