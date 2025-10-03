
'use client';

import { PopulatedOperation, PopulatedRental, UserAccount } from '@/lib/types';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';

interface OsPdfDocumentProps {
    item: PopulatedRental | PopulatedOperation;
    owner?: UserAccount | null;
}

const formatDate = (dateString: string, dateFormat = "dd 'de' MMMM 'de' yyyy") => {
    try {
        return format(parseISO(dateString), dateFormat, { locale: ptBR });
    } catch {
        return 'Data inválida';
    }
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) {
        return "N/A";
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

// Helper para máscaras de CPF/CNPJ
const applyMascaraCPF = (valor?: string) => {
    if (!valor) return '';
    return valor.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
};
const applyMascaraCNPJ = (valor?: string) => {
    if (!valor) return '';
    return valor.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
};


const InfoField = ({ label, value, className = '' }: { label: string, value: React.ReactNode, className?: string }) => (
    <div className={className}>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-800">{value || 'Não informado'}</p>
    </div>
);


export function OsPdfDocument({ item, owner }: OsPdfDocumentProps) {
    const isRental = item.itemType === 'rental';
    const rental = isRental ? item as PopulatedRental : null;
    const operation = !isRental ? item as PopulatedOperation : null;

    const osType = isRental ? 'Aluguel de Caçamba' : operation?.operationTypes.map(t => t.name).join(', ') || 'Operação';
    const osId = `${isRental ? 'AL' : 'OP'}${item.sequentialId}`;
    const pdfContainerId = `pdf-${isRental ? 'al' : 'op'}-${item.id}`;
    
    // Client and responsible info
    const clientName = item.client?.name;
    const clientPhone = item.client?.phone;
    const clientCpfCnpj = item.client?.cpfCnpj;
    const clientAddress = isRental ? rental?.deliveryAddress : operation?.destinationAddress;
    const responsibleName = isRental ? rental?.assignedToUser?.name : operation?.driver?.name;

    // Rental specific calculations
    const rentalDays = rental ? Math.max(differenceInCalendarDays(parseISO(rental.returnDate), parseISO(rental.rentalDate)) + 1, 1) : 0;
    const totalRentalValue = rental ? (rental.billingType === 'lumpSum' ? (rental.lumpSumValue || 0) : rental.value * rentalDays * (rental.dumpsters?.length || 1)) : 0;
    
    // Owner Info for header
    const ownerName = owner?.personType === 'juridica' ? owner?.companyName : owner?.name;
    const ownerDocumentValue = owner?.personType === 'juridica' ? applyMascaraCNPJ(owner?.cnpj) : applyMascaraCPF(owner?.cpf);
    const ownerDocumentLabel = owner?.personType === 'juridica' ? 'CNPJ: ' : 'CPF: ';
    const ownerPhone = owner?.phone;
    const ownerPhone2 = owner?.phone2;
    const ownerEmail = owner?.email;
    const ownerAddress = `${owner?.address || ''}, ${owner?.addressNumber || ''} - ${owner?.addressDistrict || ''}, ${owner?.addressCity || ''} - ${owner?.addressState || ''}`;

    const logoSrc = owner?.avatarUrl ? `/api/image-proxy?url=${encodeURIComponent(owner.avatarUrl)}` : '/192x192.png';


    return (
        <div id={pdfContainerId} className="bg-white p-8 font-sans flex flex-col" style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif' }}>
            <div className="flex-grow">
                {/* Header */}
                 <div className="flex justify-between items-start border-b-2 border-gray-200 pb-4">
                     <div className="flex items-center gap-4">
                       <div style={{
                            width: '80px',
                            height: '80px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                          <img
                            src={logoSrc}
                            alt="Logo da Empresa"
                            width={80}
                            height={80}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                              objectPosition: 'center',
                              display: 'block'
                            }}
                            crossOrigin="anonymous"
                          />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-bold text-gray-800">{ownerName || 'Nome da Empresa'}</h1>
                             {ownerDocumentValue && <p className="text-xs text-gray-500">{ownerDocumentLabel}{ownerDocumentValue}</p>}
                             {ownerAddress && owner?.address && <p className="text-xs text-gray-500">{ownerAddress}</p>}
                             <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 flex-wrap">
                                {ownerPhone && <span>Telefone: {ownerPhone}</span>}
                                {ownerPhone2 && <span>/ {ownerPhone2}</span>}
                                {ownerEmail && <span>E-mail: {ownerEmail}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <h2 className="text-lg font-bold text-gray-700">ORDEM DE SERVIÇO</h2>
                        <p className="text-2xl font-bold text-gray-900">#{osId}</p>
                        <p className="text-xs text-gray-500 mt-2">Data de Emissão: {format(new Date(), "dd/MM/yyyy")}</p>
                    </div>
                </div>

                {/* Service Details */}
                <div className="mt-6">
                    <h2 className="text-base font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-1 mb-3">Detalhes do Serviço</h2>
                    <InfoField label="Tipo de OS" value={osType} />
                </div>

                {/* Client Info */}
                <div className="mt-6">
                     <h2 className="text-base font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-1 mb-3">Informações do Cliente</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <InfoField label="Cliente" value={clientName} />
                        <InfoField label="Telefone" value={clientPhone} />
                        {clientCpfCnpj && (
                            <InfoField label="CPF/CNPJ" value={clientCpfCnpj} className="col-span-2" />
                        )}
                        <InfoField label="Endereço de Atendimento" value={clientAddress} className="col-span-2"/>
                    </div>
                </div>

                {/* Rental/Operation Specifics */}
                <div className="mt-6">
                    <h2 className="text-base font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-1 mb-3">Especificações</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {isRental ? (
                            <>
                                <InfoField label="Caçamba(s)" value={(rental?.dumpsters || []).map(d => `${d.name} (${d.size}m³)`).join(', ')} />
                                <InfoField label="Período do Aluguel" value={`${formatDate(rental!.rentalDate)} a ${formatDate(rental!.returnDate)}`} />
                                {rental?.billingType === 'lumpSum' ? (
                                    <InfoField label="Valor da Empreitada" value={formatCurrency(rental!.lumpSumValue)} />
                                ) : (
                                    <>
                                        <InfoField label="Valor da Diária" value={formatCurrency(rental!.value)} />
                                        <InfoField label="Valor Total Previsto" value={`${formatCurrency(totalRentalValue)} (${rentalDays} ${rentalDays > 1 ? 'dias' : 'dia'})`} />
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <InfoField label="Veículo" value={`${operation?.truck?.name} (${operation?.truck?.plate})`} />
                                <InfoField label="Data e Hora" value={operation?.startDate ? formatDate(operation.startDate, "dd/MM/yyyy 'às' HH:mm") : ''} />
                                <InfoField label="Valor do Serviço" value={formatCurrency(operation!.value)} />
                            </>
                        )}
                         <InfoField label="Responsável" value={responsibleName} />
                    </div>
                </div>

                 {/* Observations */}
                {item.observations && (
                     <div className="mt-6">
                        <h2 className="text-base font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-1 mb-3">Observações</h2>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.observations}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-auto text-center border-t-2 border-gray-200 pt-4">
                 <div className="flex justify-center items-center gap-2">
                    <Image src="/192x192.png" alt="LogiApp Logo" width={20} height={20} />
                    <div className="text-xs text-gray-500">
                        <span className="font-semibold">LogiApp</span> - Gestão de Logistica Simplificada | (32) 98430-4486
                    </div>
                </div>
            </div>
        </div>
    );
}
