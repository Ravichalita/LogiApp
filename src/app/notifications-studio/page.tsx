
"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-context";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Users, User, Building, Check } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserAccount, AdminClientView, Permissions } from "@/lib/types";
import { getAllClientAccountsAction } from "@/lib/data-server-actions";
import { getTeamMembers } from "@/lib/data";
import { updateUserPermissionsAction, sendPushNotificationAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";


const NotificationComposer = ({ userRole, clients, team, superAdminId, accountId }: { userRole: string; clients: AdminClientView[], team: UserAccount[], superAdminId: string, accountId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState(userRole === 'super' ? 'all-company' : 'my-team');
  const [targetIds, setTargetIds] = useState<string[]>([]);

  const getFormData = (): FormData => {
    const formData = new FormData();
    formData.set('title', title);
    formData.set('message', message);
    formData.set('targetType', targetType);
    formData.set('targetIds', targetIds.join(','));
    formData.set('senderAccountId', accountId);
    if(user) formData.set('createdBy', user.uid);
    return formData;
  }
  
  const resetForm = () => {
      setTitle('');
      setMessage('');
      setTargetIds([]);
      setTargetType(userRole === 'super' ? 'all-company' : 'my-team');
  }

  const handleSendNow = () => {
    if (!title || !message) {
        toast({ title: "Erro", description: "Título e mensagem são obrigatórios.", variant: 'destructive' });
        return;
    }
    const formData = getFormData();
    startTransition(async () => {
      const result = await sendPushNotificationAction(formData);
      if (result.message === 'success') {
        toast({ title: "Sucesso!", description: "Notificação enviada para a fila de envio." });
        resetForm();
      } else {
        toast({ title: "Erro", description: result.error, variant: 'destructive' });
      }
    });
  }
  
  const allClientUsers = clients.flatMap(c => c.members);
  
  const targetOptions = {
      'all-company': [],
      'my-team': [],
      'specific-clients': clients.map(c => ({ value: c.accountId, label: c.ownerName, icon: Building })),
      'specific-users': allClientUsers.map(u => ({ value: u.id, label: u.name, icon: User })),
      'specific-members': team.map(m => ({ value: m.id, label: m.name, icon: User }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar Nova Notificação</CardTitle>
        <CardDescription>Envie notificações em tempo real para sua equipe.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <Tabs value={targetType} onValueChange={(value) => { setTargetType(value); setTargetIds([]); }} className="w-full">
                <TabsList className="h-auto flex-wrap justify-start">
                {userRole === 'super' ? (
                    <>
                    <TabsTrigger value="all-company">Toda a Empresa</TabsTrigger>
                    <TabsTrigger value="specific-clients">Clientes Específicos</TabsTrigger>
                    <TabsTrigger value="specific-users">Usuários Específicos</TabsTrigger>
                    </>
                ) : (
                    <>
                    <TabsTrigger value="my-team">Minha Equipe (Todos)</TabsTrigger>
                    <TabsTrigger value="specific-members">Membros Específicos</TabsTrigger>
                    </>
                )}
                </TabsList>
                <TabsContent value="all-company">
                   <p className="text-sm text-muted-foreground pt-2">A notificação será enviada para todos os usuários da plataforma.</p>
                </TabsContent>
                <TabsContent value="my-team">
                   <p className="text-sm text-muted-foreground pt-2">A notificação será enviada para todos os membros da sua equipe.</p>
                </TabsContent>
                <TabsContent value="specific-clients">
                   <MultiSelect name="targetIds" placeholder="Selecione os clientes..." options={targetOptions['specific-clients']} onSelectionChange={setTargetIds} />
                </TabsContent>
                 <TabsContent value="specific-users">
                   <MultiSelect name="targetIds" placeholder="Selecione os usuários..." options={targetOptions['specific-users']} onSelectionChange={setTargetIds} />
                </TabsContent>
                <TabsContent value="specific-members">
                   <MultiSelect name="targetIds" placeholder="Selecione os membros..." options={targetOptions['specific-members']} onSelectionChange={setTargetIds} />
                </TabsContent>
            </Tabs>
            <div className="space-y-2">
                <label htmlFor="title">Título</label>
                <Input name="title" id="title" placeholder="Título da sua notificação" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
                <label htmlFor="message">Mensagem</label>
                <Textarea name="message" id="message" placeholder="Corpo da sua notificação" required value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="flex space-x-2 pt-2">
                <Button onClick={handleSendNow} disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : "Enviar Agora"}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};


const PermissionsSettings = ({ userRole, accountId, superAdminId }: { userRole: string; accountId: string; superAdminId: string; }) => {
  const [data, setData] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    if (userRole === 'super') {
      getAllClientAccountsAction(superAdminId).then(clients => {
        const owners = clients.map(client => client.members.find(m => m.role === 'owner')).filter(Boolean) as UserAccount[];
        setData(owners);
        setLoading(false);
      });
    } else if (userRole === 'owner' && accountId) {
      getTeamMembers(accountId, (team) => {
        const admins = team.filter(member => member.role === 'admin');
        setData(admins);
        setLoading(false);
      });
    } else {
        setLoading(false);
    }
  }, [userRole, accountId, superAdminId]);

  const handlePermissionChange = (user: UserAccount, checked: boolean) => {
    startTransition(async () => {
        const newPermissions: Permissions = {
            ...(user.permissions || {}),
            canAccessNotificationsStudio: checked
        };
        const result = await updateUserPermissionsAction(user.accountId, user.id, newPermissions);

        if (result.message === 'error') {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Sucesso!', description: `Acesso de ${user.name} foi atualizado.` });
        }
    })
  }

  if (userRole !== "super" && userRole !== "owner") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {userRole === "super" ? "Gerenciar Acesso dos Proprietários" : "Gerenciar Acesso dos Administradores"}
        </CardTitle>
        <CardDescription>
          {userRole === "super" ? "Habilite ou desabilite o acesso dos proprietários de contas às Notificações Personalizadas." : "Habilite ou desabilite o acesso dos administradores da sua equipe às Notificações Personalizadas."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="space-y-2">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
        ) : (
             <div className="space-y-2">
                {data.length > 0 ? data.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                         <div className="flex items-center gap-2">
                            {isPending && <Spinner size="small" />}
                            <Switch 
                                checked={user.permissions?.canAccessNotificationsStudio || false}
                                onCheckedChange={(checked) => handlePermissionChange(user, checked)}
                                disabled={isPending}
                            />
                        </div>
                    </div>
                )) : (
                    <p className="text-sm text-center text-muted-foreground py-4">Nenhum usuário para gerenciar.</p>
                )}
            </div>
        )}
      </CardContent>
    </Card>
  );
};


const MultiSelect = ({ name, placeholder, options, onSelectionChange }: { name: string; placeholder: string; options: { value: string, label: string, icon: React.ElementType }[], onSelectionChange: (values: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  
  const toggleSelection = (value: string) => {
    const newSelection = selectedValues.includes(value) 
        ? selectedValues.filter(v => v !== value) 
        : [...selectedValues, value];

    setSelectedValues(newSelection);
    onSelectionChange(newSelection);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={selectedValues.join(',')} />
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedValues.length > 0
            ? `${selectedValues.length} selecionado(s)`
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => toggleSelection(option.value)}
                >
                  <div className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    selectedValues.includes(option.value) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                  )}>
                    <Check className="h-4 w-4" />
                  </div>
                  <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};


export default function NotificationsStudioPage() {
  const { user, userAccount, isSuperAdmin, loading } = useAuth();
  const [clients, setClients] = useState<AdminClientView[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const getRoleForView = () => {
    if (isSuperAdmin) return "super";
    if (userAccount?.role === 'owner') return "owner";
    if (userAccount?.role === 'admin') return "admin";
    return null;
  }
  
  const userRole = getRoleForView();
  const hasAccess = userRole && (isSuperAdmin || userAccount?.permissions?.canAccessNotificationsStudio);
  
  useEffect(() => {
    if (!loading && hasAccess && user && userAccount) {
        const fetchInitialData = async () => {
            setDataLoading(true);
            try {
                if (userRole === 'super') {
                    const clientData = await getAllClientAccountsAction(user.uid);
                    setClients(clientData);
                }
                
                getTeamMembers(userAccount!.accountId, (teamData) => {
                    setTeam(teamData);
                });

            } catch (error) {
                console.error("Error fetching data for notifications studio:", error);
            } finally {
                setDataLoading(false);
            }
        };
        fetchInitialData();
    } else if (!loading) {
        setDataLoading(false);
    }
  }, [loading, hasAccess, userRole, user, userAccount]);


  if (loading || dataLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
       <div className="container mx-auto py-8 px-4 md:px-6">
            <Alert variant="destructive">
               <ShieldAlert className="h-4 w-4" />
               <AlertTitle>Acesso Negado</AlertTitle>
               <AlertDescription>
                  Você não tem permissão para visualizar esta página.{" "}
                  <Link href="/" className="underline">Voltar para o Início.</Link>
               </AlertDescription>
           </Alert>
       </div>
    )
  }
  
  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold font-headline">Notificações Personalizadas</h1>
        {userRole && user && userAccount && (
          <>
            <NotificationComposer 
                userRole={userRole} 
                clients={clients} 
                team={team} 
                superAdminId={user.uid}
                accountId={userAccount.accountId}
            />
            <PermissionsSettings userRole={userRole} accountId={userAccount.accountId} superAdminId={user!.uid} />
          </>
        )}
    </div>
  );
};
