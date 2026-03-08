import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, ImageIcon, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import SelfieCapture from "@/components/SelfieCapture";
import PhotoResultCard from "@/components/PhotoResultCard";
import PaymentModal from "@/components/PaymentModal";
import WatermarkImage from "@/components/WatermarkImage";
import { EventData, getMatchingPhotos, MOCK_EVENTS } from "@/data/mockData";
import { toast } from "sonner";

type ViewState = "gallery" | "selfie" | "results";

const EventPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams();

  const event: EventData =
    location.state?.event || MOCK_EVENTS.find((e) => e.id === eventId) || MOCK_EVENTS[0];

  const [view, setView] = useState<ViewState>("gallery");
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedPhotos, setMatchedPhotos] = useState<ReturnType<typeof getMatchingPhotos>>([]);
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [purchasedIds] = useState<Set<string>>(new Set());

  const handleCapture = (_imageData: string) => {
    setIsProcessing(true);
    // Simulate face recognition delay
    setTimeout(() => {
      const results = getMatchingPhotos(event);
      setMatchedPhotos(results);
      setIsProcessing(false);
      setView("results");
      toast.success(`¡Encontramos ${results.length} fotos donde apareces!`);
    }, 2500);
  };

  const handlePurchaseRequest = (photoId: string) => {
    setSelectedPhotoIds((prev) => new Set(prev).add(photoId));
    setPaymentModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 pb-12">
        <div className="container max-w-5xl">
          {/* Event Header */}
          <div className="mb-8 animate-fade-up">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>

            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
              {event.name}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(event.date).toLocaleDateString("es-CR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" />
                {event.photoCount} fotos
              </span>
            </div>
          </div>

          {/* View Toggle */}
          {view === "gallery" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Galería del evento
                </h2>
                <Button
                  onClick={() => setView("selfie")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-display gold-glow"
                >
                  <ScanFace className="mr-2 h-4 w-4" />
                  Encontrar mis fotos
                </Button>
              </div>

              <div className="photo-grid">
                {event.photos.map((photo, i) => (
                  <WatermarkImage
                    key={photo.id}
                    src={photo.src}
                    alt={`Foto ${i + 1}`}
                    className="aspect-square"
                  />
                ))}
              </div>
            </div>
          )}

          {view === "selfie" && (
            <div className="max-w-md mx-auto space-y-4">
              <button
                onClick={() => setView("gallery")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a la galería
              </button>
              <SelfieCapture onCapture={handleCapture} isProcessing={isProcessing} />
            </div>
          )}

          {view === "results" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    Tus resultados
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {matchedPhotos.length} foto{matchedPhotos.length !== 1 ? "s" : ""} encontrada{matchedPhotos.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setView("selfie")}
                  className="border-border text-foreground hover:bg-secondary font-display"
                >
                  <ScanFace className="mr-2 h-4 w-4" />
                  Buscar de nuevo
                </Button>
              </div>

              <div className="photo-grid">
                {matchedPhotos.map((photo, i) => (
                  <PhotoResultCard
                    key={photo.id}
                    src={photo.src}
                    matchScore={photo.matchScore ?? 0}
                    index={i}
                    isFree={i === 0}
                    isPurchased={purchasedIds.has(photo.id)}
                    onRequestPurchase={() => handlePurchaseRequest(photo.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <PaymentModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        photoCount={selectedPhotoIds.size}
        totalAmount={selectedPhotoIds.size * event.pricePerPhoto}
      />
    </div>
  );
};

export default EventPage;
