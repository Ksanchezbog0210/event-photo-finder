import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  LogOut,
  Camera,
  Calendar,
  MapPin,
  Image,
  Trash2,
  Eye,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type PurchaseRequest = Database["public"]["Tables"]["purchase_requests"]["Row"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});

  // New event form
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPrice, setNewPrice] = useState("2.00");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetchEvents();
    fetchPurchases();
  }, [user]);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setEvents(data);
      // Fetch photo counts
      for (const evt of data) {
        const { count } = await supabase
          .from("event_photos")
          .select("*", { count: "exact", head: true })
          .eq("event_id", evt.id);
        setPhotoCounts((prev) => ({ ...prev, [evt.id]: count ?? 0 }));
      }
    }
  };

  const fetchPurchases = async () => {
    const { data } = await supabase
      .from("purchase_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPurchases(data);
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("events").insert({
      admin_id: user.id,
      name: newName,
      code: newCode.toUpperCase(),
      date: newDate,
      location: newLocation,
      price_per_photo: parseFloat(newPrice),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evento creado");
    setShowNewEvent(false);
    setNewName("");
    setNewCode("");
    setNewDate("");
    setNewLocation("");
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este evento?")) return;
    await supabase.from("events").delete().eq("id", id);
    toast.success("Evento eliminado");
    fetchEvents();
  };

  const handlePhotoUpload = async (eventId: string, files: FileList) => {
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(path, file);
      if (uploadError) {
        toast.error(`Error subiendo ${file.name}`);
        continue;
      }
      await supabase.from("event_photos").insert({
        event_id: eventId,
        storage_path: path,
        original_filename: file.name,
      });
      count++;
    }
    toast.success(`${count} fotos subidas`);
    setUploading(false);
    fetchEvents();
  };

  const approvePurchase = async (id: string) => {
    await supabase
      .from("purchase_requests")
      .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Descarga aprobada");
    fetchPurchases();
  };

  const rejectPurchase = async (id: string) => {
    await supabase
      .from("purchase_requests")
      .update({ status: "rejected" })
      .eq("id", id);
    toast.info("Solicitud rechazada");
    fetchPurchases();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Camera className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-semibold text-foreground">
              Pluss<span className="text-primary">paz</span>
              <span className="text-xs text-muted-foreground ml-2">Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="border-border text-foreground hover:bg-secondary">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-20 pb-12">
        <div className="container max-w-5xl space-y-8">
          {/* Events Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">Mis eventos</h2>
              <Button
                onClick={() => setShowNewEvent(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-display"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo evento
              </Button>
            </div>

            {events.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tienes eventos aún. ¡Crea tu primero!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {events.map((evt) => (
                  <div key={evt.id} className="glass-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-foreground truncate">
                          {evt.name}
                        </h3>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(evt.date).toLocaleDateString("es-CR")}
                          </span>
                          {evt.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {evt.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Image className="h-3.5 w-3.5" />
                            {photoCounts[evt.id] ?? 0} fotos
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-semibold">
                            {evt.code}
                          </span>
                          <button onClick={() => copyCode(evt.code)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files && handlePhotoUpload(evt.id, e.target.files)}
                          />
                          <div className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 border border-primary/20 rounded-lg px-3 py-1.5 transition-colors">
                            <Upload className="h-3.5 w-3.5" />
                            {uploading ? "Subiendo..." : "Fotos"}
                          </div>
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/evento/${evt.id}`)}
                          className="border-border text-foreground hover:bg-secondary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteEvent(evt.id)}
                          className="border-destructive/20 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Requests */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-foreground">Solicitudes de compra</h2>
            {purchases.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-muted-foreground text-sm">Sin solicitudes pendientes</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {purchases.map((p) => (
                  <div key={p.id} className="glass-card p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {p.status === "pending" && <Clock className="h-4 w-4 text-primary" />}
                        {p.status === "approved" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {p.status === "rejected" && <XCircle className="h-4 w-4 text-destructive" />}
                        <span className="text-sm font-medium text-foreground">
                          {p.client_name || "Cliente"} — {p.photo_ids?.length ?? 0} foto(s)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${Number(p.total_amount).toFixed(2)} • {p.payment_method} • {p.client_phone || "Sin teléfono"}
                      </p>
                    </div>
                    {p.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approvePurchase(p.id)}
                          className="bg-green-600 hover:bg-green-700 text-foreground font-display"
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectPurchase(p.id)}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Event Dialog */}
      <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">Nuevo evento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crea un evento y comparte el código con tus clientes
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createEvent} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Nombre del evento</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Maratón San José 2026" className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Código de acceso</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} required placeholder="MARATON2026" className="bg-secondary border-border text-foreground font-display tracking-widest" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Fecha</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Precio/foto ($)</Label>
                <Input type="number" step="0.50" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Ubicación</Label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="San José, Costa Rica" className="bg-secondary border-border text-foreground" />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display">
              Crear evento
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
