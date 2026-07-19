import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { SEOHead } from '@/components/SEOHead';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Trash2, Download, Eye, AlertTriangle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const deletionSchema = z.object({
  email: z.string().email('Email inválido'),
  reason: z.string().min(10, 'Por favor, descreva brevemente o motivo (mínimo 10 caracteres)'),
  confirmDeletion: z.boolean().refine((val) => val === true, {
    message: 'Você precisa confirmar que entende que esta ação é irreversível',
  }),
});

type DeletionFormData = z.infer<typeof deletionSchema>;

const Privacidade = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<DeletionFormData>({
    resolver: zodResolver(deletionSchema),
    defaultValues: {
      email: '',
      reason: '',
      confirmDeletion: false,
    },
  });

  const onSubmit = async (data: DeletionFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('request-data-deletion', {
        body: {
          email: data.email,
          reason: data.reason,
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Solicitação enviada com sucesso! Você receberá um email de confirmação.');
      form.reset();
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast.error('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Privacidade e Proteção de Dados | MDAccula"
        description="Conheça nossos compromissos com a proteção dos seus dados pessoais conforme LGPD e GDPR. Solicite a exclusão dos seus dados a qualquer momento."
      />

      <div className="min-h-screen bg-background">
        <Navigation />

        <main id="main-content" className="pt-16">
          <PageHeader
            title="Privacidade e Proteção de Dados"
            subtitle="Respeitamos sua privacidade e estamos comprometidos com a proteção dos seus dados pessoais conforme a LGPD e GDPR."
            breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Privacidade' }]}
            variant="plain"
            align="center"
            icon={Shield}
          />
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto">
              {/* Seus Direitos */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Seus Direitos
                  </CardTitle>
                  <CardDescription>
                    Conforme a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Eye className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Acesso</h4>
                        <p className="text-sm text-muted-foreground">
                          Saber quais dados pessoais coletamos sobre você
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Download className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Portabilidade</h4>
                        <p className="text-sm text-muted-foreground">
                          Receber seus dados em formato estruturado
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Trash2 className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Exclusão</h4>
                        <p className="text-sm text-muted-foreground">
                          Solicitar a remoção dos seus dados pessoais
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Shield className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Revogação</h4>
                        <p className="text-sm text-muted-foreground">
                          Retirar seu consentimento a qualquer momento
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* FAQ */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Perguntas Frequentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Quais dados vocês coletam?</AccordionTrigger>
                      <AccordionContent>
                        Coletamos apenas dados essenciais: email para newsletter, dados de navegação
                        anônimos para analytics, e informações de contato quando você nos envia uma
                        mensagem. Não vendemos nem compartilhamos seus dados com terceiros.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Como posso cancelar a newsletter?</AccordionTrigger>
                      <AccordionContent>
                        Você pode cancelar a qualquer momento clicando no link "Cancelar inscrição"
                        no rodapé de qualquer email que enviamos, ou preenchendo o formulário de
                        exclusão abaixo.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>
                        Quanto tempo leva para excluir meus dados?
                      </AccordionTrigger>
                      <AccordionContent>
                        Processamos solicitações de exclusão em até 15 dias úteis, conforme previsto
                        na LGPD. Você receberá um email de confirmação quando a exclusão for
                        concluída.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4">
                      <AccordionTrigger>Vocês usam cookies?</AccordionTrigger>
                      <AccordionContent>
                        Sim, usamos cookies essenciais para funcionamento do site e cookies de
                        analytics (Google Analytics e Hotjar) para entender como o site é utilizado.
                        Você pode desabilitar cookies nas configurações do seu navegador.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* Formulário de Exclusão */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    Solicitar Exclusão de Dados
                  </CardTitle>
                  <CardDescription>
                    Preencha o formulário abaixo para solicitar a exclusão dos seus dados pessoais.
                    Esta ação é irreversível.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                        <Shield className="w-8 h-8 text-success" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Solicitação Enviada!</h3>
                      <p className="text-muted-foreground mb-4">
                        Você receberá um email de confirmação em breve. Processaremos sua
                        solicitação em até 15 dias úteis.
                      </p>
                      <Button variant="outline" onClick={() => setSubmitted(false)}>
                        Fazer Nova Solicitação
                      </Button>
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex gap-3">
                          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-warning/90">
                            <strong>Atenção:</strong> A exclusão de dados é permanente e inclui:
                            cancelamento da newsletter, remoção de dados de analytics e exclusão de
                            mensagens de contato associadas ao seu email.
                          </p>
                        </div>

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="seu@email.com"
                                  {...field}
                                  disabled={loading}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Motivo da solicitação (opcional, mas ajuda)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Descreva brevemente o motivo..."
                                  rows={3}
                                  {...field}
                                  disabled={loading}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="confirmDeletion"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={loading}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="cursor-pointer">
                                  Entendo que esta ação é irreversível e que meus dados serão
                                  permanentemente excluídos
                                </FormLabel>
                                <FormMessage />
                              </div>
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          variant="destructive"
                          className="w-full"
                          disabled={loading}
                        >
                          {loading ? 'Processando...' : 'Solicitar Exclusão de Dados'}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>

              {/* Contato DPO */}
              <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>
                  Para outras questões relacionadas à privacidade, entre em contato conosco através
                  da{' '}
                  <a href="/contato" className="text-primary hover:underline">
                    página de contato
                  </a>
                  .
                </p>
                <p className="mt-2">Última atualização desta política: Janeiro de 2026</p>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Privacidade;
