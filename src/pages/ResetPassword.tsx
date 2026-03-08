import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, KeyRound } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    if (type === "recovery") {
      setReady(true);
    }

    // Also listen for auth state change with recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("¡Contraseña actualizada exitosamente!");
    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-3">
            <Camera className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Pluss<span className="text-primary">paz</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Nueva contraseña</p>
        </div>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nueva contraseña</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Confirmar contraseña</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Este enlace no es válido o ha expirado. Solicita un nuevo enlace de recuperación.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="border-border text-foreground hover:bg-secondary"
            >
              Volver al login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
