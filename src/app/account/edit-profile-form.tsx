

'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type { UserAccount } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { updateUserProfileAction, deleteStorageFileAction } from '@/lib/actions';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase-client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Building2, Upload, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Helper functions for masking (can be moved to a utils file)
const applyMascaraCPF = (valor: string) => {
    return valor.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
};
const applyMascaraCNPJ = (valor: string) => {
    return valor.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
};
const applyMascaraTelefone = (valor: string) => {
    return valor.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
};
const applyMascaraCEP = (valor: string) => {
    return valor.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
};

export function EditProfileForm({ user }: { user: UserAccount }) {
    const { toast } = useToast();
    const { accountId } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [isUploading, setIsUploading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatarUrl || null);
    
    const [formData, setFormData] = useState({
        personType: user.personType || 'fisica',
        name: user.name || '',
        companyName: user.companyName || '',
        cpf: user.cpf ? applyMascaraCPF(user.cpf) : '',
        cnpj: user.cnpj ? applyMascaraCNPJ(user.cnpj) : '',
        phone: user.phone ? applyMascaraTelefone(user.phone) : '',
        phone2: user.phone2 ? applyMascaraTelefone(user.phone2) : '',
        addressZipCode: user.addressZipCode ? applyMascaraCEP(user.addressZipCode) : '',
        address: user.address || '',
        addressNumber: user.addressNumber || '',
        addressComplement: user.addressComplement || '',
        addressDistrict: user.addressDistrict || '',
        addressCity: user.addressCity || '',
        addressState: user.addressState || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let { name, value } = e.target;
        if (name === 'cpf') value = applyMascaraCPF(value);
        if (name === 'cnpj') value = applyMascaraCNPJ(value);
        if (name === 'phone' || name === 'phone2') value = applyMascaraTelefone(value);
        if (name === 'addressZipCode') value = applyMascaraCEP(value);
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!accountId) return;

        startTransition(async () => {
            const finalFormData = new FormData(event.currentTarget);
            
            // Clean masks before sending
            finalFormData.set('cpf', (formData.cpf || '').replace(/\D/g, ''));
            finalFormData.set('cnpj', (formData.cnpj || '').replace(/\D/g, ''));
            finalFormData.set('phone', (formData.phone || '').replace(/\D/g, ''));
            finalFormData.set('phone2', (formData.phone2 || '').replace(/\D/g, ''));
            finalFormData.set('addressZipCode', (formData.addressZipCode || '').replace(/\D/g, ''));

            if (avatarFile) {
                setIsUploading(true);
                try {
                    const { storage } = getFirebase();
                    const filePath = `users/${user.id}/avatar/${Date.now()}_${avatarFile.name}`;
                    const storageRef = ref(storage, filePath);
                    const uploadTask = await uploadBytesResumable(storageRef, avatarFile);
                    const downloadURL = await getDownloadURL(uploadTask.ref);

                    finalFormData.append('avatarUrl', downloadURL);
                    finalFormData.append('avatarPath', filePath);

                    // If there was an old avatar, delete it
                    if (user.avatarPath) {
                        await deleteStorageFileAction(user.avatarPath);
                    }

                } catch (error) {
                    toast({ title: 'Erro no Upload', description: 'Não foi possível enviar a imagem.', variant: 'destructive' });
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            const result = await updateUserProfileAction(user.id, null, finalFormData);
            if (result?.message === 'error') {
                toast({ title: 'Erro ao Salvar', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Sucesso!', description: 'Seu perfil foi atualizado.' });
                setAvatarFile(null); // Clear file after successful upload
            }
        });
    };

    return (
        <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                    <Avatar className="h-24 w-24 border">
                        <AvatarImage src={previewUrl || user.avatarUrl || undefined} />
                        <AvatarFallback className="text-3xl">
                            <User />
                        </AvatarFallback>
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90">
                        <Upload className="h-4 w-4" />
                        <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                </div>
                 <div className="flex-grow w-full">
                    <Tabs value={formData.personType} onValueChange={(value) => setFormData(p => ({ ...p, personType: value }))} className="w-full">
                         <input type="hidden" name="personType" value={formData.personType} />
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="fisica"><User className="mr-2 h-4 w-4" />Pessoa Física</TabsTrigger>
                            <TabsTrigger value="juridica"><Building2 className="mr-2 h-4 w-4" />Pessoa Jurídica</TabsTrigger>
                        </TabsList>
                        <TabsContent value="fisica" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo</Label>
                                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cpf">CPF</Label>
                                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" />
                            </div>
                        </TabsContent>
                        <TabsContent value="juridica" className="mt-4 space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="companyName">Razão Social</Label>
                                <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cnpj">CNPJ</Label>
                                <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Telefone 1</Label>
                    <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone2">Telefone 2 (Opcional)</Label>
                    <Input id="phone2" name="phone2" value={formData.phone2} onChange={handleChange} placeholder="(00) 00000-0000" />
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Endereço</Label>
                <div className="p-4 border rounded-lg space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="addressZipCode">CEP</Label>
                            <Input id="addressZipCode" name="addressZipCode" value={formData.addressZipCode} onChange={handleChange} placeholder="00000-000" />
                        </div>
                         <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="address">Logradouro</Label>
                            <Input id="address" name="address" value={formData.address} onChange={handleChange} placeholder="Rua, Avenida..." />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="addressNumber">Número</Label>
                            <Input id="addressNumber" name="addressNumber" value={formData.addressNumber} onChange={handleChange} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="addressComplement">Complemento</Label>
                            <Input id="addressComplement" name="addressComplement" value={formData.addressComplement} onChange={handleChange} placeholder="Apto, sala, etc." />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="addressDistrict">Bairro</Label>
                            <Input id="addressDistrict" name="addressDistrict" value={formData.addressDistrict} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="addressCity">Cidade</Label>
                            <Input id="addressCity" name="addressCity" value={formData.addressCity} onChange={handleChange} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="addressState">Estado</Label>
                            <Input id="addressState" name="addressState" value={formData.addressState} onChange={handleChange} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending || isUploading}>
                    {(isPending || isUploading) ? <Spinner size="small" /> : 'Salvar Alterações'}
                </Button>
            </div>
        </form>
    )
}
