import { PopulatedRental, PopulatedOperation, Account } from "../lib/types";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatDate = (dateString: string, dateFormat = "dd 'de' MMMM 'de' yyyy") => {
    try {
        const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
        return format(date, dateFormat, { locale: ptBR });
    } catch {
        // Fallback if it's a Timestamp object (simplified for now)
        return 'Data inválida';
    }
};

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return "N/A";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const generateOsHtml = (item: PopulatedRental | PopulatedOperation, owner: Account | null) => {
    const isRental = item.itemType === 'rental';
    const osId = isRental ? `AL${item.sequentialId}` : `OP${item.sequentialId}`;
    const osType = isRental ? 'Aluguel de Caçamba' : (item as PopulatedOperation).operationTypes?.map(t => t.name).join(', ') || 'Operação';

    const clientName = item.client?.name || 'Cliente';
    const clientPhone = item.client?.phone || '';
    const clientAddress = isRental ? (item as PopulatedRental).deliveryAddress : (item as PopulatedOperation).destinationAddress;

    const ownerName = owner?.personType === 'juridica' ? owner?.companyName : owner?.name;
    const ownerPhone = owner?.phone || '';

    // Rental Calcs
    const rentalDays = isRental && (item as PopulatedRental).rentalDate && (item as PopulatedRental).returnDate
        ? Math.max(differenceInDays(new Date((item as PopulatedRental).returnDate), new Date((item as PopulatedRental).rentalDate)) + 1, 1)
        : 0;

    // Details HTML
    let detailsHtml = '';
    if (isRental) {
        const rental = item as PopulatedRental;
        const dumpsters = rental.dumpsters?.map(d => `${d.name} (${d.size}m³)`).join(', ') || 'N/A';
        detailsHtml = `
            <div class="field">
                <span class="label">Caçamba(s):</span>
                <span class="value">${dumpsters}</span>
            </div>
            <div class="field">
                <span class="label">Período:</span>
                <span class="value">${formatDate(rental.rentalDate)} a ${formatDate(rental.returnDate)}</span>
            </div>
             <div class="field">
                <span class="label">Dias:</span>
                <span class="value">${rentalDays} dias</span>
            </div>
             <div class="field">
                <span class="label">Valor Total:</span>
                <span class="value">${formatCurrency(rental.billingType === 'lumpSum' ? rental.lumpSumValue : (rental.value * rentalDays * (rental.dumpsters?.length || 1)))}</span>
            </div>
        `;
    } else {
        const op = item as PopulatedOperation;
        detailsHtml = `
            <div class="field">
                <span class="label">Veículo:</span>
                <span class="value">${op.truck?.name || 'N/A'} (${op.truck?.plate || 'N/A'})</span>
            </div>
             <div class="field">
                <span class="label">Data/Hora:</span>
                <span class="value">${op.startDate ? formatDate(op.startDate as any, "dd/MM/yyyy 'às' HH:mm") : 'N/A'}</span>
            </div>
             <div class="field">
                <span class="label">Valor:</span>
                <span class="value">${formatCurrency(op.value)}</span>
            </div>
        `;
    }


    return `
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
      .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
      .company-name { font-size: 24px; font-weight: bold; color: #111; margin-bottom: 5px; }
      .os-title { text-align: right; }
      .os-label { font-size: 14px; color: #666; font-weight: bold; }
      .os-id { font-size: 32px; font-weight: bold; color: #000; margin: 5px 0; }
      .section { margin-bottom: 30px; }
      .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .field { margin-bottom: 10px; }
      .label { font-size: 12px; color: #888; display: block; margin-bottom: 2px; }
      .value { font-size: 16px; font-weight: 500; color: #111; }
      .footer { margin-top: 50px; text-align: center; border-top: 2px solid #eee; padding-top: 20px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="company-name">${ownerName || 'Nome da Empresa'}</div>
        <div class="label">Telefone: ${ownerPhone}</div>
      </div>
      <div class="os-title">
        <div class="os-label">ORDEM DE SERVIÇO</div>
        <div class="os-id">#${osId}</div>
        <div class="label">${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Detalhes do Serviço</div>
      <div class="field">
        <span class="label">Tipo:</span>
        <span class="value">${osType}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="grid">
        <div class="field">
            <span class="label">Nome:</span>
            <span class="value">${clientName}</span>
        </div>
        <div class="field">
            <span class="label">Telefone:</span>
            <span class="value">${clientPhone}</span>
        </div>
        <div class="field" style="grid-column: span 2;">
            <span class="label">Endereço:</span>
            <span class="value">${clientAddress}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Especificações</div>
      <div class="grid">
        ${detailsHtml}
      </div>
    </div>
    
    ${item.observations ? `
    <div class="section">
      <div class="section-title">Observações</div>
      <div class="value" style="white-space: pre-wrap;">${item.observations}</div>
    </div>
    ` : ''}

    <div class="footer">
      Gerado por LogiApp - Gestão de Logística Simplificada
    </div>
  </body>
</html>
`;
};
