import { Copy, Check, MessageCircle, Smartphone, Building2 } from "lucide-react";
import { useState } from "react";
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

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  photoCount: number;
  totalAmount: number;
  sinpePhone: string;
  onConfirm: (clientName: string, clientPhone: string, proofFile: File | null) => void;
}

type PaymentMethod = "sinpe" | "transfer";

// Información bancaria BCR (personalizable)
const BANK_INFO = {
  bank: "Banco de Costa Rica",
  accountHolder: "Plusspaz CR",
  accountNumber: "", // Se llenará cuando tengas la cuenta
  accountType: "Cuenta corriente colones",
  cedula: "", // Cédula jurídica o física
};

const PaymentModal = ({ open, onClose, photoCount, totalAmount, sinpePhone, onConfirm }: PaymentModalProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("sinpe");

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirm = async () => {
    if (!clientName.trim()) return;
    setSending(true);
    await onConfirm(clientName.trim(), clientPhone.trim(), proofFile);
    setSending(false);
    setClientName("");
    setClientPhone("");
    setProofFile(null);
  };

  const amountColones = (totalAmount * 530).toLocaleString();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">Método de pago</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {photoCount} foto{photoCount > 1 ? "s" : ""} — Total: ${totalAmount.toFixed(2)} (~₡{amountColones})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Payment Method Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod("sinpe")}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                paymentMethod === "sinpe"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span className="text-sm font-display">SINPE Móvil</span>
            </button>
            <button
              onClick={() => setPaymentMethod("transfer")}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                paymentMethod === "transfer"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-display">Transferencia</span>
            </button>
          </div>

          {/* SINPE Móvil Details */}
          {paymentMethod === "sinpe" && (
            <div className="glass-card p-4 space-y-3 animate-fade-up">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Número SINPE</span>
                <button
                  onClick={() => copyToClipboard(sinpePhone, "sinpe")}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  {copiedField === "sinpe" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedField === "sinpe" ? "Copiado" : sinpePhone}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nombre</span>
                <span className="text-sm text-foreground">Plusspaz</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto</span>
                <span className="text-sm font-semibold text-primary">₡{amountColones}</span>
              </div>
            </div>
          )}

          {/* Bank Transfer Details */}
          {paymentMethod === "transfer" && (
            <div className="glass-card p-4 space-y-3 animate-fade-up">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Banco</span>
                <span className="text-sm text-foreground">{BANK_INFO.bank}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Titular</span>
                <span className="text-sm text-foreground">{BANK_INFO.accountHolder}</span>
              </div>
              {BANK_INFO.accountNumber ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cuenta IBAN</span>
                  <button
                    onClick={() => copyToClipboard(BANK_INFO.accountNumber, "account")}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    {copiedField === "account" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedField === "account" ? "Copiado" : "Copiar IBAN"}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground text-center">
                    🏦 Próximamente — Cuenta BCR en configuración
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto</span>
                <span className="text-sm font-semibold text-primary">₡{amountColones}</span>
              </div>
            </div>
          )}

          {/* Client Info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Tu nombre</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Juan Pérez"
                required
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Tu teléfono (opcional)</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="8888-8888"
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {paymentMethod === "sinpe" ? (
                <>📱 Realiza el SINPE Móvil al número indicado. Luego presiona "Ya pagué" y el fotógrafo autorizará la descarga.</>
              ) : (
                <>🏦 Realiza la transferencia bancaria y presiona "Ya pagué". El fotógrafo verificará el depósito y autorizará la descarga.</>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 border-border text-foreground hover:bg-secondary">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={sending || !clientName.trim()}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-display"
            >
              {sending ? (
                <><Check className="mr-2 h-4 w-4" /> Enviando...</>
              ) : (
                <><MessageCircle className="mr-2 h-4 w-4" /> Ya pagué</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
