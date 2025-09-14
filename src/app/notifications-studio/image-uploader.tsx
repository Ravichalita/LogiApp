
'use client';

import { useState, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, ImageIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { UploadedImage } from '@/lib/types';
import { deleteNotificationImageAction, uploadNotificationImageAction } from '@/lib/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/auth-context';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase-client';


interface ImageUploaderProps {
  onImageSelect: (url: string) => void;
  onImageUploaded: (image: UploadedImage) => void;
  onImageDeleted: (imagePath: string) => void;
  uploadedImages: UploadedImage[];
  selectedImageUrl: string;
  uploadPath: string;
}

export const ImageUploader = ({ 
    onImageSelect,
    onImageUploaded,
    onImageDeleted,
    uploadedImages,
    selectedImageUrl,
    uploadPath 
}: ImageUploaderProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, startDeleteTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { accountId } = useAuth();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const file = e.target.files[0];
            if (file) {
                 uploadFile(file);
            }
        }
    };

    const uploadFile = (file: File) => {
        if (!accountId) {
            toast({ title: "Erro", description: "Conta não identificada.", variant: "destructive" });
            return;
        }

        const { storage } = getFirebase();
        if (!storage) return;

        setIsUploading(true);

        const fullUploadPath = `${uploadPath}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fullUploadPath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                // Optional: handle progress
            },
            (error) => {
                console.error("Upload error:", error);
                toast({
                    title: "Erro no Upload",
                    description: `Não foi possível enviar o arquivo ${file.name}.`,
                    variant: "destructive",
                });
                setIsUploading(false);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const newImage: UploadedImage = {
                        url: downloadURL,
                        path: fullUploadPath,
                    };
                    
                    const result = await uploadNotificationImageAction(accountId, newImage);

                    if (result.message === 'error' || !result.newImage) {
                         throw new Error(result.error || 'Falha ao salvar a imagem no banco de dados.');
                    }
                    
                    onImageUploaded(result.newImage);

                    toast({
                        title: "Sucesso!",
                        description: "Imagem enviada.",
                    });
                } catch (error) {
                     toast({
                        title: "Erro no Upload",
                        description: error instanceof Error ? error.message : "Não foi possível salvar a imagem.",
                        variant: "destructive",
                    });
                } finally {
                    setIsUploading(false);
                }
            }
        );
    };

    const handleDeleteImage = (imagePath: string) => {
        if (!accountId || !imagePath) {
            toast({ title: "Erro", description: "Caminho da imagem ou ID da conta ausente.", variant: "destructive" });
            return;
        }

        startDeleteTransition(async () => {
            const { storage } = getFirebase();
            if (!storage) {
                toast({ title: "Erro", description: "Serviço de armazenamento não inicializado.", variant: "destructive" });
                return;
            }

            const fileRef = ref(storage, imagePath);

            try {
                // Step 1: Delete from Storage
                await deleteObject(fileRef);
            } catch (storageError: any) {
                // If the file doesn't exist in storage, we can still proceed to delete from DB
                if (storageError.code !== 'storage/object-not-found') {
                    console.error("Storage deletion error:", storageError);
                    toast({ title: "Erro de Armazenamento", description: "Não foi possível remover o arquivo do servidor, mas a referência será removida.", variant: "destructive" });
                }
            }

            // Step 2: Delete from DB via Server Action
            const result = await deleteNotificationImageAction(accountId, imagePath);
            if (result.message === 'success') {
                onImageDeleted(imagePath);
                toast({ title: 'Imagem Excluída', description: 'A imagem foi removida com sucesso.' });
            } else {
                toast({ title: 'Erro de Banco de Dados', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <div className="space-y-2">
            <Label htmlFor="image-upload-button-input" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Imagem da Notificação (Opcional)
            </Label>
             <p className="text-xs text-muted-foreground">
                Faça o upload de uma imagem ou clique em uma já existente para selecioná-la.
            </p>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                disabled={isUploading}
                id="image-upload-button-input"
            />
            
            <div className="flex w-full overflow-x-auto gap-2 pt-2 pb-2">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="shrink-0 h-24 w-24 bg-muted/50 border border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted hover:border-solid hover:border-primary"
                    aria-label="Adicionar anexo"
                >
                    {isUploading ? <Spinner /> : <Upload className="h-8 w-8" />}
                </button>

                {uploadedImages.map((image) => (
                    <div key={image.path} className="relative group shrink-0">
                         <button
                            type="button"
                            onClick={() => onImageSelect(image.url)}
                            className={cn(
                                "h-24 w-24 rounded-md border-2 p-1 overflow-hidden",
                                selectedImageUrl === image.url ? "border-primary ring-2 ring-primary" : "border-transparent hover:border-muted-foreground"
                            )}
                         >
                            <Image src={image.url} alt="Preview" layout="fill" objectFit="contain" className="rounded-md" />
                         </button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Imagem Permanentemente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta ação não pode ser desfeita. A imagem será removida do banco de imagens e não poderá ser usada em futuras notificações.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteImage(image.path)} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                        {isDeleting ? <Spinner size="small" /> : 'Sim, Excluir'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
            </div>
        </div>
    );
};
