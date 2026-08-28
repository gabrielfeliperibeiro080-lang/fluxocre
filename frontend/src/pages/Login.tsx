import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Se o usuário não existir, vamos criá-lo automaticamente no primeiro acesso para facilitar
        if (error.message.includes('Invalid login credentials')) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });
          
          if (signUpError) throw signUpError;
          
          if (!signUpData.session) {
             toast({ 
               title: 'Conta criada! Confirmação Pendente', 
               description: 'O Supabase exige confirmação de e-mail. Por favor, desative a "Email Confirmations" no painel do Supabase (Auth > Providers > Email) OU clique no link enviado para o seu e-mail.',
               variant: 'destructive',
               duration: 8000
             });
             return; // não redireciona
          }

          toast({ title: 'Conta criada!', description: 'Sua conta foi criada e logada com sucesso.' });
          navigate('/');
          return;
        }
        
        throw error;
      }

      toast({ title: 'Bem-vindo de volta!', description: 'Login realizado com sucesso.' });
      navigate('/');
    } catch (error: any) {
      toast({ title: 'Erro de Autenticação', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Acesso ao Sistema</CardTitle>
          <CardDescription>
            Insira seu e-mail e senha para entrar. Se for seu primeiro acesso, a conta será criada automaticamente.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar / Criar Conta'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
