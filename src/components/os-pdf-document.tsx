
'use client';

import { PopulatedOperation, PopulatedRental } from '@/lib/types';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';

interface OsPdfDocumentProps {
    item: PopulatedRental | PopulatedOperation;
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

const InfoField = ({ label, value, className = '' }: { label: string, value: React.ReactNode, className?: string }) => (
    <div className={className}>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
);


export function OsPdfDocument({ item }: OsPdfDocumentProps) {
    const isRental = item.itemType === 'rental';
    const rental = isRental ? item as PopulatedRental : null;
    const operation = !isRental ? item as PopulatedOperation : null;

    const osType = isRental ? 'Aluguel de Caçamba' : operation?.operationTypes.map(t => t.name).join(', ') || 'Operação';
    const osId = `${isRental ? 'AL' : 'OP'}${item.sequentialId}`;
    const pdfContainerId = `pdf-${isRental ? 'al' : 'op'}-${item.id}`;
    const clientName = item.client?.name;
    const clientPhone = item.client?.phone;
    const clientCpfCnpj = item.client?.cpfCnpj;
    const clientAddress = isRental ? rental?.deliveryAddress : operation?.destinationAddress;
    const responsibleName = isRental ? rental?.assignedToUser?.name : operation?.driver?.name;

    const rentalDays = rental ? Math.max(differenceInCalendarDays(parseISO(rental.returnDate), parseISO(rental.rentalDate)) + 1, 1) : 0;
    const totalRentalValue = rental ? (rental.billingType === 'lumpSum' ? (rental.lumpSumValue || 0) : rental.value * rentalDays * (rental.dumpsters?.length || 1)) : 0;


    return (
        <div id={pdfContainerId} className="bg-white p-8 font-sans" style={{ width: '210mm', height: '297mm', fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-gray-200 pb-4">
                <div className="flex items-center gap-4">
                     <div className="h-[50px] w-[50px] flex-shrink-0">
                        <Image src="/192x192.png" alt="Logotipo" width={50} height={50} style={{ objectFit: 'contain' }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Ordem de Serviço #{osId}</h1>
                        <p className="text-sm text-gray-500">LogiApp - Gestão de Logística</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">Data de Emissão: {format(new Date(), "dd/MM/yyyy")}</p>
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

            {/* Footer */}
            <div className="mt-12 text-center border-t-2 border-gray-200 pt-4">
                <p className="text-xs text-gray-500">
                    Este é um documento gerado pelo sistema LogiApp. Em caso de dúvidas, entre em contato.
                </p>
            </div>
        </div>
    );
}
