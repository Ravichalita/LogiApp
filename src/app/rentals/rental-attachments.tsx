
'use client';

import { useState, useTransition } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase-client';
import { useAuth } from '@/context/auth-context';
import type { Attachment, PopulatedRental, CompletedRental } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { addAttachmentToRentalAction, addAttachmentToCompletedRentalAction } from '@/lib/actions';
import { nanoid } from 'nanoid';
import { File, Upload, Trash2, Download, Paperclip, Image as ImageIcon, FileText, FileQuestion } from 'lucide-react';
import Link from 'next/link';

interface RentalAttachmentsProps {
    rental: PopulatedRental | CompletedRental;
    isCompleted: boolean;
}

function getFileIcon(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension!)) {
        return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
    }
    if (extension === 'pdf') {
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
    if (['doc', 'docx', 'txt'].includes(extension!)) {
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
    return <FileQuestion className="h-5 w-5 text-muted-foreground" />;
}

export function RentalAttachments({ rental, isCompleted }: RentalAttachmentsProps) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const { storage } = getFirebase();
    const [isPending, startTransition] = useTransition();
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleUpload(file);
        }
    };

    const handleUpload = (file: File) => {
        if (!accountId || !storage) {
            toast({ title: 'Erro', description: 'Serviço de armazenamento não disponível.', variant: 'destructive' });
            return;
        }

        setUploadingFile(file);
        setUploadProgress(0);

        const storagePath = `accounts/${accountId}/${isCompleted ? 'completed_rentals' : 'rentals'}/${rental.id}/${nanoid()}-${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload error:", error);
                toast({ title: 'Erro de Upload', description: 'Não foi possível enviar o arquivo.', variant: 'destructive' });
                setUploadingFile(null);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    const newAttachment: Attachment = {
                        name: file.name,
                        url: downloadURL,
                        type: file.type,
                    };
                    
                    startTransition(async () => {
                        const action = isCompleted ? addAttachmentToCompletedRentalAction : addAttachmentToRentalAction;
                        const result = await action(accountId, rental.id, newAttachment);

                        if (result.message === 'success') {
                            toast({ title: 'Sucesso', description: 'Anexo adicionado.' });
                        } else {
                            toast({ title: 'Erro', description: 'Não foi possível salvar o anexo.', variant: 'destructive' });
                            // Clean up uploaded file if DB operation fails
                            deleteObject(storageRef).catch(console.error);
                        }
                        setUploadingFile(null);
                    });
                });
            }
        );
    };

    const attachments = rental.attachments || [];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Button asChild size="sm" variant="outline">
                    <label htmlFor={`file-upload-${rental.id}`}>
                        <Upload className="mr-2 h-4 w-4" />
                        Adicionar Anexo
                    </label>
                </Button>
                <input id={`file-upload-${rental.id}`} type="file" className="hidden" onChange={handleFileChange} disabled={!!uploadingFile || isPending} />
            </div>

            {uploadingFile && (
                <div className="p-2 border rounded-md bg-muted">
                    <div className="flex items-center justify-between text-sm">
                        <p className="truncate">{uploadingFile.name}</p>
                        {isPending ? <Spinner size="small" /> : <span>{Math.round(uploadProgress)}%</span>}
                    </div>
                    <Progress value={uploadProgress} className="h-2 mt-1" />
                </div>
            )}
            
            <div className="space-y-2">
                {attachments.length > 0 ? (
                    attachments.map((att, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                            <div className="flex items-center gap-2 min-w-0">
                                {getFileIcon(att.name)}
                                <span className="text-sm truncate font-medium">{att.name}</span>
                            </div>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                <Link href={att.url} target="_blank" download={att.name}>
                                    <Download className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-center text-muted-foreground py-2">Nenhum anexo adicionado.</p>
                )}
            </div>
        </div>
    );
}
