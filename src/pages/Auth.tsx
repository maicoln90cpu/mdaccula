import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { SEOHead } from '@/components/SEOHead';

// Schema de validação de senha forte
const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
  .regex(/[0-9]/, 'Inclua um número')
  .regex(/[^A-Za-z0-9]/, 'Inclua um caractere especial (!@#$%^&*)');

const signUpSchema = z.object({
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  fullName: z.string().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  phone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone inválido'),
});

// Requisitos de senha para feedback visual
const passwordRequirements = [
  { regex: /.{8,}/, label: 'Mínimo 8 caracteres' },
  { regex: /[A-Z]/, label: 'Uma letra maiúscula' },
  { regex: /[0-9]/, label: 'Um número' },
  { regex: /[^A-Za-z0-9]/, label: 'Um caractere especial' },
];

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordFeedback, setShowPasswordFeedback] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const passwordValue = formData.get('password') as string;

    const { error } = await signIn(email, passwordValue);

    if (error) {
      setError(error.message);
    } else {
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo de volta.',
      });
      navigate('/');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const passwordValue = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const phone = formData.get('phone') as string;

    // Validação com Zod
    const validation = signUpSchema.safeParse({
      email,
      password: passwordValue,
      fullName,
      phone,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, passwordValue, fullName, phone);

    if (error) {
      setError(error.message);
    } else {
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você já pode fazer login.',
      });
      navigate('/');
    }
    setLoading(false);
  };

  const getPasswordStrength = () => {
    const passed = passwordRequirements.filter((req) => req.regex.test(password)).length;
    if (passed === 0) return { label: '', color: '' };
    if (passed <= 1) return { label: 'Fraca', color: 'text-destructive' };
    if (passed <= 2) return { label: 'Média', color: 'text-yellow-500' };
    if (passed <= 3) return { label: 'Boa', color: 'text-blue-500' };
    return { label: 'Forte', color: 'text-green-500' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
      <SEOHead title="Autenticação" description="Acesso ao sistema MDAccula." noindex />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Acesso ao Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    name="fullName"
                    type="text"
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Telefone</Label>
                  <Input
                    id="signup-phone"
                    name="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signup-password">Senha</Label>
                    {password && (
                      <span className={`text-xs font-medium ${passwordStrength.color}`}>
                        {passwordStrength.label}
                      </span>
                    )}
                  </div>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setShowPasswordFeedback(true)}
                    required
                  />
                  {/* Feedback visual dos requisitos */}
                  {showPasswordFeedback && (
                    <div className="mt-2 p-3 rounded-md bg-muted/50 space-y-1">
                      {passwordRequirements.map((req, index) => {
                        const passed = req.regex.test(password);
                        return (
                          <div
                            key={index}
                            className={`flex items-center gap-2 text-xs ${passed ? 'text-green-500' : 'text-muted-foreground'}`}
                          >
                            {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>{req.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
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
