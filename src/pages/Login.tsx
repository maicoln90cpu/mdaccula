import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Entrar"
        description="Acesse sua conta MDAccula."
        noindex
      />
      <Navigation />

      <main id="main-content" className="pt-16 min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 hero-text neon-glow">MDAccula</h1>
              <p className="text-muted-foreground">
                {isLogin
                  ? "Acesse sua conta e fique por dentro dos melhores eventos"
                  : "Junte-se à maior comunidade de música eletrônica do Brasil"}
              </p>
            </div>

            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-2xl text-center">{isLogin ? "Entrar" : "Criar Conta"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Form */}
                <form className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="name" placeholder="Seu nome completo" className="pl-10" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" placeholder="seu@email.com" className="pl-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="********"
                        className="pl-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="confirmPassword" type="password" placeholder="********" className="pl-10" />
                      </div>
                    </div>
                  )}

                  {isLogin && (
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 text-sm">
                        <input type="checkbox" className="rounded border-border" />
                        <span>Lembrar-me</span>
                      </label>
                      <Button variant="link" className="text-sm text-primary p-0">
                        Esqueceu a senha?
                      </Button>
                    </div>
                  )}

                  <Button className="w-full btn-neon" size="lg">
                    <span>{isLogin ? "Entrar" : "Criar Conta"}</span>
                  </Button>
                </form>

                {/* Switch between login/register */}
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
                  </span>
                  <Button variant="link" className="text-sm text-primary p-0" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Criar conta" : "Fazer login"}
                  </Button>
                </div>

                {!isLogin && (
                  <div className="text-xs text-muted-foreground text-center space-y-2">
                    <p>
                      Ao criar uma conta, você concorda com nossos{" "}
                      <Button variant="link" className="text-xs text-primary p-0 h-auto">
                        Termos de Uso
                      </Button>{" "}
                      e{" "}
                      <Button variant="link" className="text-xs text-primary p-0 h-auto">
                        Política de Privacidade
                      </Button>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card className="mt-8 card-hover bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-center text-primary">Benefícios de ter uma conta</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    Acesso antecipado aos ingressos
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-secondary rounded-full mr-3"></div>
                    Descontos exclusivos em eventos
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
                    Notificações de novos eventos
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    Conteúdo exclusivo do MDAccula Radio
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Login;
