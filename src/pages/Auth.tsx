import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const authSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta girin").max(255),
  password: z.string().trim().min(6, "Şifre en az 6 karakter olmalı").max(128),
});

type AuthFormValues = z.infer<typeof authSchema>;

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    document.title = "Giriş | Sohbet Uygulaması";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Sohbet uygulamasına giriş yapın veya yeni hesap oluşturun.");
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
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
  });

  const onSubmit = async (values: AuthFormValues) => {
    if (mode === "login") {
      const { error } = await signIn(values.email, values.password);
      if (error) {
        toast({
          variant: "destructive",
          title: "Giriş başarısız",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Hoş geldin",
        description: "Başarıyla giriş yapıldı.",
      });
      navigate("/", { replace: true });
    } else {
      const { error } = await signUp(values.email, values.password);
      if (error) {
        toast({
          variant: "destructive",
          title: "Kayıt başarısız",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Kayıt başarılı",
        description: "Lütfen e-posta kutunu kontrol ederek hesabını doğrula.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">Sohbete Katıl</CardTitle>
          <CardDescription>Hesabına giriş yap veya yeni bir hesap oluştur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "login" | "signup")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Giriş</TabsTrigger>
              <TabsTrigger value="signup">Kayıt ol</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>
                <Button className="w-full" type="submit" disabled={isSubmitting || loading}>
                  {isSubmitting ? "İşleniyor..." : "Giriş yap"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="signup-email">E-posta</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-password">Şifre</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>
                <Button className="w-full" type="submit" disabled={isSubmitting || loading}>
                  {isSubmitting ? "İşleniyor..." : "Kayıt ol"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
