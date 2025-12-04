import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setNickname } from "@/lib/chat-api";

const nicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, "İsim en az 2 karakter olmalı")
    .max(32, "İsim en fazla 32 karakter olabilir"),
});

type NicknameFormValues = z.infer<typeof nicknameSchema>;

const Auth = () => {
  const { user, loading, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Sohbete Katıl | İsim Seç";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Sohbete katılmak için sadece bir takma ad seç; e-posta gerekmez.",
      );
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NicknameFormValues>({
    resolver: zodResolver(nicknameSchema),
  });

  const onSubmit = async ({ nickname }: NicknameFormValues) => {
    const value = nickname.trim();

    try {
      if (!user) {
        const random =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const safeRandom = random.toString().replace(/[^a-zA-Z0-9]/g, "");
        const email = `${safeRandom}@guest.local`;
        const password = `Guest!${safeRandom.slice(0, 24) || "Password123!"}`;

        const { error } = await signUp(email, password);
        if (error) {
          toast({
            variant: "destructive",
            title: "Bağlantı hatası",
            description: error.message ?? "Geçici hesap oluşturulamadı.",
          });
          return;
        }
      }

      const data = await setNickname(value);

      toast({
        title: "Hazırsın",
        description: `Artık "${data.user.nickname}" olarak sohbete katılabilirsin.`,
      });

      navigate("/", { replace: true });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error?.message ?? "İsmin kaydedilirken bir sorun oluştu.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <main className="w-full max-w-md" aria-labelledby="nickname-auth-title">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle
              id="nickname-auth-title"
              className="text-2xl font-semibold tracking-tight"
            >
              Sohbete Katıl
            </CardTitle>
            <CardDescription>
              Sadece bir takma ad seç; hesap oluşturman gerekmez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="nickname">Takma adın</Label>
                <Input
                  id="nickname"
                  autoComplete="off"
                  placeholder="Örneğin: MatematikKurdu"
                  {...register("nickname")}
                />
                {errors.nickname && (
                  <p className="text-xs text-destructive">{errors.nickname.message}</p>
                )}
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting || loading}>
                {isSubmitting || loading ? "Hazırlanıyor..." : "Sohbete başla"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
