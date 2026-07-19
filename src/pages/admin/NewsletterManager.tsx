import { useState, useEffect } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib';
import {
  Download,
  Mail,
  Trash2,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Subscriber {
  id: string;
  email: string;
  subscribed_at: string;
  source: string | null;
  confirmed: boolean;
  unsubscribed_at: string | null;
}

export default function NewsletterManager() {
  const navigate = useNavigate();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMass, setSendingMass] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showMassEmailDialog, setShowMassEmailDialog] = useState(false);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  useRealtimeTable('newsletter_subscribers', () => fetchSubscribers());

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
    } catch (error) {
      logger.error('Error fetching subscribers', error, { component: 'NewsletterManager' });
      toast.error('Erro ao carregar inscritos');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const activeSubscribers = subscribers.filter((s) => !s.unsubscribed_at);
    const csvContent = [
      ['Email', 'Data de Inscrição', 'Origem', 'Confirmado'],
      ...activeSubscribers.map((s) => [
        s.email,
        format(new Date(s.subscribed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        s.source || 'N/A',
        s.confirmed ? 'Sim' : 'Não',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `newsletter-subscribers-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${activeSubscribers.length} emails exportados com sucesso`);
  };

  const handleMassEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Preencha o assunto e o corpo do email');
      return;
    }

    const activeSubscribers = subscribers.filter((s) => !s.unsubscribed_at && s.confirmed);

    if (activeSubscribers.length === 0) {
      toast.error('Nenhum inscrito ativo confirmado encontrado');
      return;
    }

    setSendingMass(true);

    try {
      const { error } = await supabase.functions.invoke('send-mass-newsletter', {
        body: {
          subject: emailSubject,
          body: emailBody,
          recipients: activeSubscribers.map((s) => s.email),
        },
      });

      if (error) throw error;

      toast.success(`Email enviado para ${activeSubscribers.length} inscritos`);
      setShowMassEmailDialog(false);
      setEmailSubject('');
      setEmailBody('');
    } catch (error) {
      logger.error('Error sending mass email', error, { component: 'NewsletterManager' });
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao enviar emails em massa';
      toast.error(errorMessage);
    } finally {
      setSendingMass(false);
    }
  };

  const deleteSubscriber = async (id: string) => {
    try {
      const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);

      if (error) throw error;

      toast.success('Inscrito removido com sucesso');
      fetchSubscribers();
    } catch (error) {
      logger.error('Error deleting subscriber', error, { component: 'NewsletterManager' });
      toast.error('Erro ao remover inscrito');
    }
  };

  const activeSubscribers = subscribers.filter((s) => !s.unsubscribed_at);
  const confirmedSubscribers = activeSubscribers.filter((s) => s.confirmed);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gerenciador de Newsletter</h1>
              <p className="text-muted-foreground">
                Gerencie os inscritos da newsletter e envie emails em massa
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Inscritos</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscribers.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inscritos Ativos</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSubscribers.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{confirmedSubscribers.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Ações</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportToCSV} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>

                  <Dialog open={showMassEmailDialog} onOpenChange={setShowMassEmailDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={confirmedSubscribers.length === 0}>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Email em Massa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Enviar Email em Massa</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="subject">Assunto</Label>
                          <Input
                            id="subject"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Digite o assunto do email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="body">Mensagem</Label>
                          <Textarea
                            id="body"
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            placeholder="Digite o corpo do email"
                            rows={10}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-muted-foreground">
                            Será enviado para {confirmedSubscribers.length} inscritos confirmados
                          </p>
                          <Button onClick={handleMassEmail} disabled={sendingMass}>
                            {sendingMass ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Inscritos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Data de Inscrição</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">{subscriber.email}</TableCell>
                      <TableCell>
                        {format(new Date(subscriber.subscribed_at), 'dd/MM/yyyy HH:mm', {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{subscriber.source || 'N/A'}</TableCell>
                      <TableCell>
                        {subscriber.unsubscribed_at ? (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelado
                          </Badge>
                        ) : subscriber.confirmed ? (
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirmado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSubscriber(subscriber.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
