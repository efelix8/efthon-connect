import { useState, type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "site_access_verified";

interface SiteGateProps {
  children: ReactNode;
}

export const SiteGate = ({ children }: SiteGateProps) => {
  const [isVerified, setIsVerified] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-site-password", {
        body: { password },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.valid) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        setIsVerified(true);
      } else {
        setError("Yanlış şifre");
      }
    } catch (err) {
      console.error("Password verification error:", err);
      setError("Doğrulama sırasında bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border bg-card shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Siteye Giriş
          </CardTitle>
          <CardDescription>
            Devam etmek için şifreyi girin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="site-password">Şifre</Label>
              <Input
                id="site-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <Button className="w-full" type="submit" disabled={isLoading || !password.trim()}>
              {isLoading ? "Doğrulanıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
