import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Camera, ScanFace, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import heroBanner from "@/assets/hero-banner.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Ingresa un código de acceso");
      return;
    }
    setLoading(true);
    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    setLoading(false);
    if (error || !event) {
      toast.error("Código no encontrado. Verifica con tu fotógrafo.");
      return;
    }
    navigate(`/evento/${event.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img src={heroBanner} alt="Evento profesional" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />
        </div>

        <div className="relative z-10 container max-w-2xl text-center px-4">
          <div className="animate-fade-up space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary backdrop-blur-sm">
              <ScanFace className="h-4 w-4" />
              Reconocimiento facial inteligente
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              Encuentra tus fotos{" "}
              <span className="gold-gradient-text">al instante</span>
            </h1>

            <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
              Ingresa tu código de evento, tómate una selfie y descubre
              todas las fotos donde apareces. Así de simple.
            </p>

            <form onSubmit={handleSubmit} className="max-w-sm mx-auto">
              <div className="glass-card p-2 flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Código de acceso"
                  className="border-0 bg-transparent text-foreground placeholder:text-muted-foreground font-display text-center text-lg tracking-widest focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 font-display shrink-0"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Search, title: "Ingresa tu código", desc: "Tu fotógrafo te dará un código único para acceder a las fotos del evento." },
              { icon: Camera, title: "Tómate una selfie", desc: "Nuestra IA compara tu rostro con miles de fotos en segundos." },
              { icon: Shield, title: "Descarga tus fotos", desc: "Recibe 1 foto gratis y compra las demás por solo $2 cada una." },
            ].map((step, i) => (
              <div key={i} className="glass-card p-6 text-center animate-fade-up" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">© 2026 Plusspaz — Fotografía deportiva profesional</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
