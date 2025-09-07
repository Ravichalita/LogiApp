
"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Users, User, Building, Check, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserAccount, AdminClientView, UploadedImage, Account } from "@/lib/types";
import { getAllClientAccountsAction } from "@/lib/data-server-actions";
import { getTeamMembers, getAccount } from "@/lib/data";
import { sendPushNotificationAction, updateNotificationImagesAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "./image-uploader";


const NotificationComposer = ({ userRole, clients, team, accountId, account }: { userRole: string; clients: AdminClientView[], team: UserAccount[], accountId: string, account: Account | null }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState(''); // The currently selected image URL
  const [linkUrl, setLinkUrl] = useState('');
  const [targetType, setTargetType] = useState(userRole === 'super' ? 'all-company' : 'my-team');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  
  // State for the image gallery, initialized from the account data
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUpdatingImages, startImagesTransition] = useTransition();
  
  useEffect(() => {
    // This effect synchronizes the local state with the account data from the database
    if (account?.notificationImages) {
        setUploadedImages(account.notificationImages);
    }
  }, [account]);


  const getFormData = (): FormData => {
    const formData = new FormData();
    formData.set('title', title);
    formData.set('message', message);
    formData.set('imageUrl', imageUrl);
    formData.set('linkUrl', linkUrl);
    formData.set('targetType', targetType);
    formData.set('targetIds', targetIds.join(','));
    formData.set('senderAccountId', accountId);
    if(user) formData.set('createdBy', user.uid);
    return formData;
  }
  
  const resetForm = () => {
      setTitle('');
      setMessage('');
      setImageUrl('');
      setLinkUrl('');
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
  
  const handleImageUploaded = (newImage: UploadedImage) => {
    const newImageList = [...uploadedImages, newImage];
    setUploadedImages(newImageList);
    startImagesTransition(async () => {
        await updateNotificationImagesAction(accountId, newImageList);
    });
  }
  
  const handleImageDeleted = (imagePath: string) => {
      const newImageList = uploadedImages.filter(img => img.path !== imagePath);
      setUploadedImages(newImageList);
      if (imageUrl === uploadedImages.find(img => img.path === imagePath)?.url) {
          setImageUrl(''); // Clear selection if the deleted image was selected
      }
      startImagesTransition(async () => {
          await updateNotificationImagesAction(accountId, newImageList);
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
        <CardDescription>Envie notificações com imagem e link em tempo real.</CardDescription>
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
                <Label htmlFor="title">Título</Label>
                <Input name="title" id="title" placeholder="Título da sua notificação" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea name="message" id="message" placeholder="Corpo da sua notificação" required value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            
             <ImageUploader 
                selectedImageUrl={imageUrl}
                onImageSelect={setImageUrl}
                uploadedImages={uploadedImages}
                onImageUploaded={handleImageUploaded}
                onImageDeleted={handleImageDeleted}
                uploadPath={`accounts/${accountId}/notifications/images`}
            />

             <div className="space-y-2">
                <Label htmlFor="linkUrl" className="flex items-center gap-2">
                     <LinkIcon className="h-4 w-4" />
                     URL do Link (Opcional)
                </Label>
                <Input name="linkUrl" id="linkUrl" placeholder="https://exemplo.com/pagina" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
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
  const { user, userAccount, isSuperAdmin, loading, accountId } = useAuth();
  const [clients, setClients] = useState<AdminClientView[]>([]);
  const [team, setTeam] = useState<UserAccount[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const getRoleForView = () => {
    if (isSuperAdmin) return "super";
    if (userAccount?.role === 'owner' || userAccount?.role === 'admin') return "admin";
    return null;
  }
  
  const userRole = getRoleForView();
  const hasAccess = isSuperAdmin || userAccount?.permissions?.canAccessNotificationsStudio;
  
  useEffect(() => {
    if (!loading && hasAccess && user && accountId) {
        let unsubTeam = () => {};
        let unsubAccount = () => {};

        const fetchInitialData = async () => {
            setDataLoading(true);
            try {
                if (userRole === 'super') {
                    const clientData = await getAllClientAccountsAction(user.uid);
                    setClients(clientData);
                }
                
                unsubTeam = getTeamMembers(accountId, setTeam);
                unsubAccount = getAccount(accountId, setAccount);

            } catch (error) {
                console.error("Error fetching data for notifications studio:", error);
            } finally {
                setDataLoading(false);
            }
        };

        fetchInitialData();
        
        return () => {
            unsubTeam();
            unsubAccount();
        };

    } else if (!loading) {
        setDataLoading(false);
    }
  }, [loading, hasAccess, userRole, user, accountId]);


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
        {userRole && user && accountId && (
          <>
            <NotificationComposer 
                userRole={userRole} 
                clients={clients} 
                team={team} 
                accountId={accountId}
                account={account}
            />
          </>
        )}
    </div>
  );
};
