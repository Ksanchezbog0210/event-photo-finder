import { Camera } from "lucide-react";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Camera className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Foto<span className="text-primary">Find</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Encuentra tus fotos al instante
          </span>
        </nav>
      </div>
    </header>
  );
};

export default Header;
