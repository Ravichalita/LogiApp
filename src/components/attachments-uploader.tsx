
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, File as FileIcon, X, Paperclip } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase-client';
import type { Attachment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from './ui/spinner';

interface AttachmentsUploaderProps {
  accountId: string;
  onAttachmentUploaded: (attachment: Attachment) => void;
  uploadPath: string; // e.g., 'accounts/{accountId}/operations/{opId}/attachments'
}

export const AttachmentsUploader = ({ accountId, onAttachmentUploaded, uploadPath }: AttachmentsUploaderProps) => {
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

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

        setIsUploading(file.name);
        const fullUploadPath = uploadPath.replace('{accountId}', accountId);
        const storageRef = ref(storage, `${fullUploadPath}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            },
            (error) => {
                console.error("Upload error:", error);
                toast({
                    title: "Erro no Upload",
                    description: `Não foi possível enviar o arquivo ${file.name}.`,
                    variant: "destructive",
                });
                setIsUploading(null);
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
                    setIsUploading(null);
                    setUploadProgress(prev => {
                        const newProgress = {...prev};
                        delete newProgress[file.name];
                        return newProgress;
                    });
                });
            }
        );
    };

    return (
        <div className="space-y-2">
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                disabled={!!isUploading}
            />
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!isUploading}
                className="w-full"
            >
                {isUploading ? (
                    <>
                        <Spinner size="small" className="mr-2" />
                        <span>Enviando {isUploading}...</span>
                    </>
                ) : (
                    <>
                        <Upload className="mr-2 h-4 w-4" />
                        Adicionar Anexo
                    </>
                )}
            </Button>
            {isUploading && uploadProgress[isUploading] > 0 && (
                 <Progress value={uploadProgress[isUploading]} className="w-full h-2" />
            )}
        </div>
    );
};
