/**
 * R-079 — @hookform/resolvers v5 precisa continuar entregando as mensagens de erro do zod.
 *
 * A v5 mudou a assinatura interna do `zodResolver`. Se a ligação entre o schema (zod)
 * e o formulário (react-hook-form) quebrar, o build continua passando e o formulário
 * simplesmente para de validar (envia dado inválido) ou para de mostrar a mensagem.
 * Este teste prova o caminho completo: campo inválido -> mensagem na tela -> submit bloqueado;
 * campo válido -> submit com os dados tipados.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  nome: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
});

type FormValues = z.infer<typeof schema>;

function TestForm({ onValid }: { onValid: (values: FormValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', email: '' },
  });

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <label htmlFor="nome">Nome</label>
      <input id="nome" {...register('nome')} />
      {errors.nome && <span role="alert">{errors.nome.message}</span>}

      <label htmlFor="email">E-mail</label>
      <input id="email" {...register('email')} />
      {errors.email && <span role="alert">{errors.email.message}</span>}

      <button type="submit">Enviar</button>
    </form>
  );
}

describe('R-079 — zodResolver (@hookform/resolvers v5)', () => {
  it('bloqueia o envio e mostra as mensagens do schema quando os campos são inválidos', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    await user.type(screen.getByLabelText('Nome'), 'ab');
    await user.type(screen.getByLabelText('E-mail'), 'nao-e-email');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => {
      expect(screen.getByText('Nome muito curto')).toBeInTheDocument();
    });
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('envia os dados quando o formulário é válido', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    await user.type(screen.getByLabelText('Nome'), 'Maicon');
    await user.type(screen.getByLabelText('E-mail'), 'dj@mdaccula.com');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => {
      expect(onValid).toHaveBeenCalledTimes(1);
    });
    expect(onValid.mock.calls[0][0]).toMatchObject({
      nome: 'Maicon',
      email: 'dj@mdaccula.com',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
