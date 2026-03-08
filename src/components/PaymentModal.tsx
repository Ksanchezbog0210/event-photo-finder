import { Copy, Check, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SINPE_INFO } from "@/data/mockData";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  photoCount: number;
  totalAmount: number;
}

const PaymentModal = ({ open, onClose, photoCount, totalAmount }: PaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const copyNumber = () => {
    navigator.clipboard.writeText(SINPE_INFO.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendConfirmation = () => {
    setSent(true);
    // Simulate sending confirmation request
    setTimeout(() => {
      onClose();
      setSent(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">Pago con SINPE Móvil</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {photoCount} foto{photoCount > 1 ? "s" : ""} — Total: ${totalAmount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Número SINPE</span>
              <button
                onClick={copyNumber}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : SINPE_INFO.phone}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="text-sm text-foreground">{SINPE_INFO.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monto</span>
              <span className="text-sm font-semibold text-primary">
                ₡{(totalAmount * 530).toLocaleString()} (~${totalAmount.toFixed(2)})
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              📱 Realiza el SINPE Móvil al número indicado. Luego confirma tu pago 
              y el fotógrafo autorizará la descarga de tus fotos.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 border-border text-foreground hover:bg-secondary">
              Cancelar
            </Button>
            <Button
              onClick={sendConfirmation}
              disabled={sent}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-display"
            >
              {sent ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enviado
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ya pagué
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
