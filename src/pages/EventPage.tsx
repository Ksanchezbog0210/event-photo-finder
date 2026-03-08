import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, ImageIcon, ScanFace, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import SelfieCapture from "@/components/SelfieCapture";
import PhotoResultCard from "@/components/PhotoResultCard";
import PaymentModal from "@/components/PaymentModal";
import WatermarkImage from "@/components/WatermarkImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Photo = Database["public"]["Tables"]["event_photos"]["Row"];

interface MatchedPhoto extends Photo {
  publicUrl: string;
  matchScore: number;
}

type ViewState = "gallery" | "selfie" | "results";

const EventPage = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<(Photo & { publicUrl: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>("gallery");
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedPhotos, setMatchedPhotos] = useState<MatchedPhoto[]>([]);
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [purchaseRequestId, setPurchaseRequestId] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data: evt } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    if (!evt) {
      toast.error("Evento no encontrado");
      navigate("/");
      return;
    }
    setEvent(evt);

    const { data: eventPhotos } = await supabase
      .from("event_photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (eventPhotos) {
      const withUrls = eventPhotos.map((p) => {
        const { data } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
        return { ...p, publicUrl: data.publicUrl };
      });
      setPhotos(withUrls);
    }
    setLoading(false);
  }, [eventId, navigate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Poll for purchase approval
  useEffect(() => {
    if (!purchaseRequestId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("purchase_requests")
        .select("status, photo_ids")
        .eq("id", purchaseRequestId)
        .maybeSingle();
      if (data?.status === "approved") {
        const approvedIds = (data.photo_ids as string[]) || [];
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          approvedIds.forEach((id) => next.add(id));
          return next;
        });
        toast.success("¡Pago aprobado! Ya puedes descargar tus fotos.");
        setPurchaseRequestId(null);
      } else if (data?.status === "rejected") {
        toast.error("Solicitud rechazada. Contacta al fotógrafo.");
        setPurchaseRequestId(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [purchaseRequestId]);

  const handleCapture = (_imageData: string) => {
    setIsProcessing(true);
    // Simulate face recognition: randomly select ~60% of photos as matches
    setTimeout(() => {
      const shuffled = [...photos].sort(() => Math.random() - 0.5);
      const matchCount = Math.max(2, Math.ceil(photos.length * 0.6));
      const results: MatchedPhoto[] = shuffled.slice(0, matchCount).map((p) => ({
        ...p,
        matchScore: 0.65 + Math.random() * 0.33, // 65-98%
      })).sort((a, b) => b.matchScore - a.matchScore);

      setMatchedPhotos(results);
      setIsProcessing(false);
      setView("results");
      toast.success(`¡Encontramos ${results.length} fotos donde apareces!`);
    }, 2500);
  };

  const handlePurchaseRequest = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      if (prev.includes(photoId)) return prev;
      return [...prev, photoId];
    });
    setPaymentModal(true);
  };

  const handlePaymentConfirmed = async (clientName: string, clientPhone: string) => {
    if (!event || selectedPhotoIds.length === 0) return;
    const { data, error } = await supabase.from("purchase_requests").insert({
      event_id: event.id,
      photo_ids: selectedPhotoIds,
      client_name: clientName,
      client_phone: clientPhone,
      total_amount: selectedPhotoIds.length * Number(event.price_per_photo),
      currency: event.currency,
      payment_method: "sinpe",
    }).select("id").single();

    if (error) {
      toast.error("Error al enviar solicitud");
      return;
    }
    setPurchaseRequestId(data.id);
    setPaymentModal(false);
    toast.success("Solicitud enviada. El fotógrafo verificará tu pago y aprobará la descarga.");
  };

  const handleDownload = async (photo: MatchedPhoto) => {
    const response = await fetch(photo.publicUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = photo.original_filename || `plusspaz-${photo.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Foto descargada");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) return null;

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
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">{event.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(event.date).toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}
              </span>
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" />
                {photos.length} fotos
              </span>
            </div>
          </div>

          {/* Gallery View */}
          {view === "gallery" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Galería del evento</h2>
                {photos.length > 0 && (
                  <Button onClick={() => setView("selfie")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-display gold-glow">
                    <ScanFace className="mr-2 h-4 w-4" />
                    Encontrar mis fotos
                  </Button>
                )}
              </div>
              {photos.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">El fotógrafo aún no ha subido fotos a este evento.</p>
                </div>
              ) : (
                <div className="photo-grid">
                  {photos.map((photo, i) => (
                    <WatermarkImage key={photo.id} src={photo.publicUrl} alt={`Foto ${i + 1}`} className="aspect-square" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selfie View */}
          {view === "selfie" && (
            <div className="max-w-md mx-auto space-y-4">
              <button onClick={() => setView("gallery")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Volver a la galería
              </button>
              <SelfieCapture onCapture={handleCapture} isProcessing={isProcessing} />
            </div>
          )}

          {/* Results View */}
          {view === "results" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Tus resultados</h2>
                  <p className="text-sm text-muted-foreground">
                    {matchedPhotos.length} foto{matchedPhotos.length !== 1 ? "s" : ""} encontrada{matchedPhotos.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setView("selfie")} className="border-border text-foreground hover:bg-secondary font-display">
                  <ScanFace className="mr-2 h-4 w-4" />
                  Buscar de nuevo
                </Button>
              </div>

              {purchaseRequestId && (
                <div className="glass-card p-4 border-primary/30 animate-pulse-gold">
                  <p className="text-sm text-primary font-display flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Esperando aprobación del fotógrafo...
                  </p>
                </div>
              )}

              <div className="photo-grid">
                {matchedPhotos.map((photo, i) => (
                  <PhotoResultCard
                    key={photo.id}
                    src={photo.publicUrl}
                    matchScore={photo.matchScore}
                    index={i}
                    isFree={i === 0}
                    isPurchased={purchasedIds.has(photo.id)}
                    pricePerPhoto={Number(event.price_per_photo)}
                    onRequestPurchase={() => handlePurchaseRequest(photo.id)}
                    onDownload={() => handleDownload(photo)}
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
        photoCount={selectedPhotoIds.length}
        totalAmount={selectedPhotoIds.length * Number(event.price_per_photo)}
        sinpePhone="89406622"
        onConfirm={handlePaymentConfirmed}
      />
    </div>
  );
};

export default EventPage;
