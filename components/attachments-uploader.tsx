import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebase } from '../lib/firebase';
import { Attachment } from '../lib/types';
import { Button } from './ui/button';
import { X, Paperclip, Image as ImageIcon } from 'lucide-react-native';

interface AttachmentsUploaderProps {
    accountId: string;
    attachments: Attachment[];
    onChange: (attachments: Attachment[]) => void;
    disabled?: boolean;
}

export function AttachmentsUploader({ accountId, attachments, onChange, disabled }: AttachmentsUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const { storage } = getFirebase();

    const pickImage = async () => {
        if (disabled) return;

        // Request permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, // Upload original
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            await uploadFile(result.assets[0]);
        }
    };

    const uploadFile = async (asset: ImagePicker.ImagePickerAsset) => {
        if (!accountId) {
            Alert.alert('Erro', 'Conta não identificada.');
            return;
        }

        setUploading(true);
        try {
            const uri = asset.uri;
            const filename = uri.split('/').pop() || `image_${Date.now()}.jpg`;
            const path = `accounts/${accountId}/attachments/${Date.now()}_${filename}`;
            const storageRef = ref(storage, path);

            // Convert URI to Blob
            const response = await fetch(uri);
            const blob = await response.blob();

            // Upload
            await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(storageRef);

            const newAttachment: Attachment = {
                id: Date.now().toString(),
                name: filename,
                url: url,
                path: path,
                type: 'image/jpeg', // Simplified for now
            };

            onChange([...attachments, newAttachment]);

        } catch (error: any) {
            console.error("Upload error:", error);
            Alert.alert('Erro no Upload', 'Falha ao enviar imagem.');
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = async (attachment: Attachment) => {
        if (disabled) return;

        Alert.alert(
            'Remover anexo',
            'Deseja remover este anexo?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Remover', style: 'destructive', onPress: async () => {
                        // Remove from list immediately for UX
                        const newAttachments = attachments.filter(a => a.id !== attachment.id);
                        onChange(newAttachments);

                        // Delete from storage (optional, maybe keep it until form submit? 
                        // But usually we clean up if the user explicitly removes it).
                        // In web app we delete it.
                        try {
                            const storageRef = ref(storage, attachment.path);
                            await deleteObject(storageRef);
                        } catch (error) {
                            console.error("Error deleting file:", error);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View className="space-y-4">
            <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-gray-900">Anexos</Text>
                <Text className="text-sm text-gray-500">{attachments.length} arquivo(s)</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
                {attachments.map((att) => (
                    <View key={att.id} className="w-24 h-24 relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                        <Image source={{ uri: att.url }} className="w-full h-full" resizeMode="cover" />
                        <TouchableOpacity
                            onPress={() => removeAttachment(att)}
                            className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                            disabled={disabled}
                        >
                            <X size={12} color="white" />
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity
                    onPress={pickImage}
                    disabled={disabled || uploading}
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50"
                >
                    {uploading ? (
                        <ActivityIndicator color="#F97316" />
                    ) : (
                        <>
                            <Paperclip size={24} color="#9CA3AF" />
                            <Text className="text-xs text-gray-500 mt-1">Adicionar</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}
