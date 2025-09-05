

'use client';

import { useState, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Paperclip, Plus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase-client';
import type { Attachment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from './ui/spinner';
import { deleteAttachmentFromCompletedItemAction } from '@/lib/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Label } from './ui/label';

interface AttachmentsUploaderProps {
  accountId: string;
  attachments: Attachment[];
  onAttachmentUploaded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachment: Attachment) => void;
  uploadPath: string; // e.g., 'accounts/{accountId}/operations/{opId}/attachments'
  showDeleteButton?: boolean;
}

export const AttachmentsUploader = ({ 
    accountId, 
    attachments,
    onAttachmentUploaded,
    onAttachmentDeleted,
    uploadPath,
    showDeleteButton = true
}: AttachmentsUploaderProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [isDeleting, startDeleteTransition] = useTransition();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const file = e.target.files[0];
            if (file) {
                 uploadFile(file);
            }
        }
    };

    const uploadFile = (file: File) => {
        const { storage } = getFirebase();
        if (!storage) return;

        setIsUploading(true);
        const fullUploadPath = uploadPath.replace('{accountId}', accountId);
        const storageRef = ref(storage, `${fullUploadPath}/${Date.now()}_${file.name}`);
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
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    const newAttachment: Attachment = {
                        url: downloadURL,
                        name: file.name,
                        type: file.type,
                        uploadedAt: new Date().toISOString(),
                    };
                    onAttachmentUploaded(newAttachment);
                    toast({
                        title: "Sucesso!",
                        description: `Arquivo ${file.name} enviado.`,
                    });
                    setIsUploading(false);
                });
            }
        );
    };

     const handleDeleteAttachment = (attachment: Attachment) => {
        startDeleteTransition(async () => {
             try {
                // Here we would ideally call a server action to delete from storage if needed
                // For now, we just remove it from the state via the parent callback
                onAttachmentDeleted(attachment);
                toast({ title: 'Sucesso', description: 'Anexo removido.' });
            } catch (error) {
                toast({ title: 'Erro', description: 'Não foi possível remover o anexo.', variant: 'destructive' });
            }
        });
    };

    return (
        <div className="space-y-2">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
            />
             <div className="flex w-full overflow-x-auto gap-2 pt-2 pb-2">
                {attachments.map((att, index) => (
                    <div key={index} className="relative group shrink-0">
                        <a 
                            href={att.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="relative group shrink-0 h-20 w-20 bg-muted/50 border rounded-md p-2 flex flex-col items-center justify-center text-center hover:bg-muted"
                        >
                            <Paperclip className="h-6 w-6 text-muted-foreground" />
                            <span className="text-xs break-all line-clamp-2 mt-1">{att.name}</span>
                        </a>
                         {showDeleteButton && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10">
                                        <X className="h-3 w-3" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir Anexo?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. O arquivo "{att.name}" será removido permanentemente.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteAttachment(att)} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                            {isDeleting ? <Spinner size="small" /> : 'Excluir'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="shrink-0 h-20 w-20 bg-muted/50 border border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted hover:border-solid hover:border-primary"
                    aria-label="Adicionar anexo"
                >
                    {isUploading ? <Spinner /> : <Plus className="h-8 w-8" />}
                </button>
            </div>
        </div>
    );
};
